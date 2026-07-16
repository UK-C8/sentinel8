"""
Fingerprint generation and raw scanner output normalization.
Fingerprint must be stable: same issue across scans → same fingerprint → dedup UPSERT.
"""
import hashlib
from typing import Any


def fp(*parts: str) -> str:
    key = ":".join(parts)
    return hashlib.sha256(key.encode()).hexdigest()


def normalize_trivy(tenant_id: str, connector_id: str, asset: str, raw: dict[str, Any]) -> list[dict]:
    """Trivy JSON output (trivy fs --format json)."""
    findings = []
    for result in raw.get("Results", []):
        target = result.get("Target", asset)
        for vuln in result.get("Vulnerabilities") or []:
            cve_id = vuln.get("VulnerabilityID", "")
            pkg = vuln.get("PkgName", "")
            installed = vuln.get("InstalledVersion", "")
            fixed_v = vuln.get("FixedVersion", "")
            severity = _map_severity(vuln.get("Severity", "UNKNOWN"))
            title = f"{cve_id} in {pkg}@{installed}" + (f" (fix: {fixed_v})" if fixed_v else "")
            findings.append({
                "tenant_id": tenant_id,
                "connector_id": connector_id,
                "type": "cve",
                "severity": severity,
                "asset": f"{asset}/{target}",
                "fingerprint": fp(tenant_id, "trivy", cve_id, pkg, target),
                "title": title,
                "rule_id": cve_id,
                "source_scanner": "trivy",
                "raw": vuln,
            })
    return findings


def normalize_semgrep(tenant_id: str, connector_id: str, asset: str, raw: dict[str, Any]) -> list[dict]:
    """Semgrep JSON output (semgrep scan --json)."""
    findings = []
    for r in raw.get("results", []):
        rule_id = r.get("check_id", "")
        path = r.get("path", "")
        line = r.get("start", {}).get("line", 0)
        severity = _map_semgrep_severity(r.get("extra", {}).get("severity", "WARNING"))
        title = r.get("extra", {}).get("message", rule_id)[:200]
        findings.append({
            "tenant_id": tenant_id,
            "connector_id": connector_id,
            "type": "misconfig",
            "severity": severity,
            "asset": f"{asset}/{path}",
            "fingerprint": fp(tenant_id, "semgrep", rule_id, path, str(line)),
            "title": title,
            "rule_id": rule_id,
            "source_scanner": "semgrep",
            "raw": r,
        })
    return findings


def normalize_gitleaks(tenant_id: str, connector_id: str, asset: str, raw: list[dict[str, Any]]) -> list[dict]:
    """Gitleaks JSON report (array of leak objects)."""
    findings = []
    for leak in (raw or []):
        rule_id = leak.get("RuleID", "")
        file_ = leak.get("File", "")
        line = leak.get("StartLine", 0)
        commit = leak.get("Commit", "")
        title = f"Secret detected: {rule_id} in {file_}:{line}"
        findings.append({
            "tenant_id": tenant_id,
            "connector_id": connector_id,
            "type": "secret",
            "severity": "critical",
            "asset": f"{asset}/{file_}",
            # Commit-anchored: same secret in same file across branches deduplicates correctly
            "fingerprint": fp(tenant_id, "gitleaks", rule_id, file_, str(line), commit[:7]),
            "title": title,
            "rule_id": rule_id,
            "source_scanner": "gitleaks",
            "raw": leak,
        })
    return findings


def _map_severity(s: str) -> str:
    return {
        "CRITICAL": "critical",
        "HIGH": "high",
        "MEDIUM": "medium",
        "LOW": "low",
        "UNKNOWN": "informational",
    }.get(s.upper(), "informational")


def _map_semgrep_severity(s: str) -> str:
    return {
        "ERROR": "high",
        "WARNING": "medium",
        "INFO": "low",
        "INVENTORY": "informational",
    }.get(s.upper(), "informational")
