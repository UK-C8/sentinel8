"""
Sentinel8 scanner worker.
Polls scan_jobs with SELECT FOR UPDATE SKIP LOCKED, runs GitHub repo scanners,
normalizes findings, UPSERTs into Postgres.

Deploy as a long-running Railway service (see Dockerfile).
Set DATABASE_URL, GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY in Railway env vars.
"""
import json
import logging
import os
import shutil
import socket
import subprocess
import tempfile
import time
import traceback
import uuid

import psycopg2
import psycopg2.extras
import requests

import sys
sys.path.insert(0, os.path.dirname(__file__))

from normalize import normalize_trivy, normalize_semgrep, normalize_gitleaks
from scanners import trivy, semgrep, gitleaks

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

WORKER_ID = f"{socket.gethostname()}-{uuid.uuid4().hex[:8]}"
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL_SECONDS", "15"))
JOB_TIMEOUT_SECONDS = int(os.getenv("JOB_TIMEOUT_SECONDS", "1800"))  # 30 min

POSTHOG_KEY = os.getenv("POSTHOG_KEY")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com")


def ph_capture(event: str, distinct_id: str, properties: dict | None = None) -> None:
    """Fire a PostHog event. No-op without POSTHOG_KEY. Never raises."""
    if not POSTHOG_KEY:
        return
    try:
        requests.post(
            f"{POSTHOG_HOST}/capture/",
            json={
                "api_key": POSTHOG_KEY,
                "event": event,
                "distinct_id": distinct_id,
                "properties": {**(properties or {}), "$lib": "sentinel8-worker"},
            },
            timeout=5,
        )
    except Exception:
        pass  # analytics must never break a scan


def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


def github_installation_token(installation_id: str) -> str:
    """Exchange GitHub App credentials for a short-lived installation token."""
    import time as _time
    from cryptography.hazmat.primitives import serialization, hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    from cryptography.hazmat.backends import default_backend
    import base64

    app_id = os.environ["GITHUB_APP_ID"]
    # Support either a file path (GITHUB_APP_PRIVATE_KEY_FILE) or inline PEM
    key_file = os.environ.get("GITHUB_APP_PRIVATE_KEY_FILE")
    if key_file:
        with open(key_file) as f:
            private_key_pem = f.read().encode()
    else:
        private_key_pem = os.environ["GITHUB_APP_PRIVATE_KEY"].replace("\\n", "\n").encode()

    now = int(_time.time())
    header = base64.urlsafe_b64encode(json.dumps({"alg": "RS256", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({"iat": now - 60, "exp": now + 600, "iss": app_id}).encode()).rstrip(b"=").decode()
    unsigned = f"{header}.{payload}"

    private_key = serialization.load_pem_private_key(private_key_pem, password=None, backend=default_backend())
    signature = private_key.sign(unsigned.encode(), padding.PKCS1v15(), hashes.SHA256())
    sig_b64 = base64.urlsafe_b64encode(signature).rstrip(b"=").decode()
    jwt = f"{unsigned}.{sig_b64}"

    resp = requests.post(
        f"https://api.github.com/app/installations/{installation_id}/access_tokens",
        headers={
            "Authorization": f"Bearer {jwt}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["token"]


def list_repos(token: str, installation_id: str) -> list[dict]:
    """List all repos accessible to this installation."""
    repos = []
    url = "https://api.github.com/installation/repositories"
    while url:
        resp = requests.get(
            url,
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            params={"per_page": 100},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        repos.extend(data.get("repositories", []))
        url = resp.links.get("next", {}).get("url")
    return repos


def clone_repo(clone_url_with_token: str, dest: str) -> None:
    subprocess.run(
        ["git", "clone", "--depth=1", "--quiet", clone_url_with_token, dest],
        check=True, capture_output=True, timeout=300,
    )


def upsert_findings(conn, findings: list[dict]) -> int:
    if not findings:
        return 0
    with conn.cursor() as cur:
        inserted = 0
        for f in findings:
            cur.execute(
                """
                INSERT INTO findings
                  (tenant_id, connector_id, type, severity, asset, fingerprint,
                   title, rule_id, source_scanner, raw, status)
                VALUES
                  (%(tenant_id)s, %(connector_id)s, %(type)s, %(severity)s,
                   %(asset)s, %(fingerprint)s, %(title)s, %(rule_id)s,
                   %(source_scanner)s, %(raw)s, 'open')
                ON CONFLICT (tenant_id, fingerprint) DO UPDATE
                  SET last_seen      = now(),
                      severity       = EXCLUDED.severity,
                      source_scanner = EXCLUDED.source_scanner,
                      raw            = EXCLUDED.raw
                RETURNING (xmax = 0) AS was_inserted
                """,
                {**f, "raw": json.dumps(f.get("raw", {})), "connector_id": f.get("connector_id")},
            )
            row = cur.fetchone()
            if row and row["was_inserted"]:
                # Emit 'opened' event for new findings only
                cur.execute(
                    """
                    INSERT INTO finding_events (finding_id, actor, event_type)
                    SELECT id, 'system', 'opened' FROM findings
                    WHERE tenant_id = %(tenant_id)s AND fingerprint = %(fingerprint)s
                    """,
                    f,
                )
                inserted += 1
    return inserted


def mark_fix_proposed_resolved(conn, tenant_id: str, seen_fingerprints: set[str]) -> int:
    """
    Acceptance criteria: findings can only flip to 'fixed' after a scan_confirmed event.
    For any finding in fix_proposed state whose fingerprint was NOT seen in this scan,
    emit scan_confirmed then transition to fixed.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, fingerprint FROM findings
            WHERE tenant_id = %s AND status = 'fix_proposed'
            """,
            (tenant_id,),
        )
        resolved = 0
        for row in cur.fetchall():
            if row["fingerprint"] not in seen_fingerprints:
                cur.execute(
                    """
                    INSERT INTO finding_events (finding_id, actor, event_type, reason)
                    VALUES (%s, 'system', 'scan_confirmed', 'Not seen in latest scan')
                    """,
                    (row["id"],),
                )
                cur.execute(
                    "UPDATE findings SET status = 'fixed' WHERE id = %s",
                    (row["id"],),
                )
                resolved += 1
    return resolved


SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "informational": 4}


def clone_public_repo(url: str, dest: str) -> None:
    """Clone a public repo with NO credentials. Fails fast on private/auth prompts."""
    subprocess.run(
        ["git", "clone", "--depth=1", "--single-branch", "--quiet", url, dest],
        check=True, capture_output=True, timeout=300,
        env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
    )


def process_free_scan(conn, scan: dict) -> None:
    """
    Free lead-magnet scan of a PUBLIC repo. No tenant, no connector.
    Writes severity counts + a sanitized teaser (no secret values, no raw).
    """
    url = scan["repo_url"]
    display = scan["repo_display"]
    tmpdir = tempfile.mkdtemp()
    try:
        log.info("Free scan cloning %s", display)
        clone_public_repo(url, tmpdir)

        trivy_raw = trivy.scan(tmpdir)
        semgrep_raw = semgrep.scan(tmpdir)
        gitleaks_raw = gitleaks.scan(tmpdir)

        # Reuse normalizers with placeholder ids (rows are never inserted into findings)
        findings = (
            normalize_trivy("free", "free", display, trivy_raw)
            + normalize_semgrep("free", "free", display, semgrep_raw)
            + normalize_gitleaks("free", "free", display, gitleaks_raw)
        )
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)

    counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for f in findings:
        if f["severity"] in counts:
            counts[f["severity"]] += 1

    # Full findings list, sorted by severity. title/asset are location-only (safe);
    # NEVER include raw (which holds the secret value for gitleaks).
    ordered = sorted(findings, key=lambda f: SEVERITY_ORDER.get(f["severity"], 9))
    safe = [
        {
            "severity": f["severity"],
            "scanner": f["source_scanner"],
            "type": f["type"],
            "title": f["title"],
            "rule_id": f.get("rule_id") or "",
            "asset": f["asset"],
        }
        for f in ordered
    ]
    # Teaser kept for backward-compat (top 5); full list drives the results page + PDF.
    teaser = [{"severity": s["severity"], "scanner": s["scanner"], "title": s["title"]} for s in safe[:5]]

    with conn.cursor() as cur:
        cur.execute(
            """UPDATE free_scans
               SET status='completed', completed_at=now(),
                   crit_count=%s, high_count=%s, med_count=%s, low_count=%s,
                   teaser=%s, findings=%s
               WHERE id=%s""",
            (counts["critical"], counts["high"], counts["medium"], counts["low"],
             json.dumps(teaser), json.dumps(safe), scan["id"]),
        )
    conn.commit()
    ph_capture("free_scan_completed", scan["ip_hash"], {"repo": display, **counts})
    log.info("Free scan %s done: %s", display, counts)


def poll_free_scan_once(conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, repo_url, repo_display, ip_hash FROM free_scans
            WHERE status = 'pending'
            ORDER BY created_at ASC
            LIMIT 1
            FOR UPDATE SKIP LOCKED
            """,
        )
        scan = cur.fetchone()
        if not scan:
            return False
        cur.execute("UPDATE free_scans SET status='running' WHERE id=%s", (scan["id"],))
    conn.commit()

    try:
        process_free_scan(conn, scan)
    except Exception:
        log.exception("Free scan %s failed", scan["id"])
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE free_scans SET status='failed', completed_at=now(), error=%s WHERE id=%s",
                (traceback.format_exc()[-500:], scan["id"]),
            )
        conn.commit()
    return True


def process_github_job(conn, job: dict) -> None:
    connector_id = str(job["connector_id"])
    tenant_id = str(job["tenant_id"])
    installation_id = job["credential_ref"]

    log.info("Fetching GitHub installation token for installation %s", installation_id)
    token = github_installation_token(installation_id)

    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO connector_events (connector_id, tenant_id, actor, event_type)
               VALUES (%s, %s, 'system', 'token_fetched')""",
            (connector_id, tenant_id),
        )

    repos = list_repos(token, installation_id)
    log.info("Found %d repos for installation %s", len(repos), installation_id)

    all_findings: list[dict] = []
    for repo in repos:
        repo_name = repo["full_name"]
        clone_url = repo["clone_url"].replace("https://", f"https://x-access-token:{token}@")
        tmpdir = tempfile.mkdtemp()
        try:
            log.info("Cloning %s", repo_name)
            clone_repo(clone_url, tmpdir)

            trivy_raw = trivy.scan(tmpdir)
            semgrep_raw = semgrep.scan(tmpdir)
            gitleaks_raw = gitleaks.scan(tmpdir)

            all_findings += normalize_trivy(tenant_id, connector_id, repo_name, trivy_raw)
            all_findings += normalize_semgrep(tenant_id, connector_id, repo_name, semgrep_raw)
            all_findings += normalize_gitleaks(tenant_id, connector_id, repo_name, gitleaks_raw)

        except Exception:
            log.warning("Failed scanning %s:\n%s", repo_name, traceback.format_exc())
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    inserted = upsert_findings(conn, all_findings)
    seen = {f["fingerprint"] for f in all_findings}
    resolved = mark_fix_proposed_resolved(conn, tenant_id, seen)
    log.info("Job done: %d findings upserted (%d new), %d resolved", len(all_findings), inserted, resolved)

    with conn.cursor() as cur:
        cur.execute(
            """INSERT INTO connector_events (connector_id, tenant_id, actor, event_type, metadata)
               VALUES (%s, %s, 'system', 'scan_completed', %s)""",
            (connector_id, tenant_id, json.dumps({"findings": len(all_findings), "new": inserted, "resolved": resolved})),
        )
    # finding_opened / finding_resolved fire as aggregate counts here, not per-row
    # (per-finding events would flood PostHog on a 5k-asset scan).
    # ponytail: aggregate counts; split to per-finding only if cohort analysis needs it.
    ph_capture("scan_completed", str(tenant_id), {"findings": len(all_findings), "opened": inserted, "resolved": resolved})
    if inserted:
        ph_capture("finding_opened", str(tenant_id), {"count": inserted})
    if resolved:
        ph_capture("finding_resolved", str(tenant_id), {"count": resolved})


def poll_once(conn) -> bool:
    """Dequeue one job. Returns True if a job was processed."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT sj.id, sj.tenant_id, sj.connector_id,
                   c.provider, c.credential_ref
            FROM scan_jobs sj
            JOIN connectors c ON c.id = sj.connector_id AND c.revoked_at IS NULL
            WHERE sj.status = 'pending'
              AND sj.scheduled_for <= now()
            ORDER BY sj.scheduled_for ASC
            LIMIT 1
            FOR UPDATE OF sj SKIP LOCKED
            """,
        )
        job = cur.fetchone()
        if not job:
            return False

        cur.execute(
            """UPDATE scan_jobs
               SET status='running', started_at=now(), locked_by=%s, locked_at=now()
               WHERE id=%s""",
            (WORKER_ID, job["id"]),
        )
        cur.execute(
            """INSERT INTO connector_events (connector_id, tenant_id, actor, event_type, metadata)
               VALUES (%s, %s, 'system', 'scan_started', %s)""",
            (job["connector_id"], job["tenant_id"], json.dumps({"worker": WORKER_ID})),
        )
    conn.commit()
    ph_capture("scan_started", str(job["tenant_id"]), {"connector_id": str(job["connector_id"])})

    try:
        if job["provider"] == "github":
            process_github_job(conn, job)
        else:
            log.info("Provider %s not yet supported in Phase 1 — skipping", job["provider"])

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE scan_jobs SET status='completed', completed_at=now() WHERE id=%s",
                (job["id"],),
            )
        conn.commit()

    except Exception:
        log.exception("Job %s failed", job["id"])
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE scan_jobs SET status='failed', completed_at=now() WHERE id=%s",
                (job["id"],),
            )
            cur.execute(
                """INSERT INTO connector_events (connector_id, tenant_id, actor, event_type, metadata)
                   VALUES (%s, %s, 'system', 'scan_failed', %s)""",
                (job["connector_id"], job["tenant_id"],
                 json.dumps({"error": traceback.format_exc()[-1000:]})),
            )
        conn.commit()

    return True


def main():
    log.info("Worker %s starting", WORKER_ID)
    conn = get_conn()
    try:
        while True:
            try:
                # Free lead-magnet scans take priority — they have a human waiting.
                processed = poll_free_scan_once(conn) or poll_once(conn)
                if not processed:
                    time.sleep(POLL_INTERVAL)
            except psycopg2.OperationalError:
                log.warning("DB connection lost, reconnecting…")
                try:
                    conn.close()
                except Exception:
                    pass
                time.sleep(5)
                conn = get_conn()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
