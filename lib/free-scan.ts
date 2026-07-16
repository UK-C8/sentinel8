import crypto from "crypto";
import pool from "./db";

// Public endpoint = attack surface. Allowlist hosts (kills SSRF to internal
// IPs / cloud metadata), enforce owner/repo shape, reject credentials in URL.
const ALLOWED_HOSTS = new Set(["github.com", "gitlab.com"]);
const REPO_PATH = /^\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/;

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5;                    // scans per IP per window

export interface NormalizedRepo {
  url: string;      // clone URL the worker uses
  display: string;  // owner/repo
}

export function validateRepoUrl(raw: string): NormalizedRepo | { error: string } {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { error: "Not a valid URL" };
  }
  if (u.protocol !== "https:") return { error: "Only https:// URLs are allowed" };
  if (u.username || u.password) return { error: "URLs with credentials are not allowed" };
  if (!ALLOWED_HOSTS.has(u.hostname)) {
    return { error: `Only public ${[...ALLOWED_HOSTS].join(" / ")} repos are supported` };
  }
  const m = u.pathname.match(REPO_PATH);
  if (!m) return { error: "URL must point to a repository (host/owner/repo)" };
  const [, owner, repo] = m;
  return {
    url: `https://${u.hostname}/${owner}/${repo}.git`,
    display: `${owner}/${repo}`,
  };
}

export function hashIp(ip: string): string {
  const salt = process.env.FREE_SCAN_SALT ?? "sentinel8-dev-salt";
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

export function makeShareToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

/** Postgres-based rate limit — no Redis. ponytail: swap for Redis if IP volume grows. */
export async function isRateLimited(ipHash: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM free_scans
     WHERE ip_hash = $1 AND created_at > now() - ($2::int * interval '1 millisecond')`,
    [ipHash, RATE_WINDOW_MS]
  );
  return rows[0].n >= RATE_MAX;
}

export async function createFreeScan(repo: NormalizedRepo, ipHash: string): Promise<string> {
  const token = makeShareToken();
  await pool.query(
    `INSERT INTO free_scans (share_token, repo_url, repo_display, ip_hash)
     VALUES ($1, $2, $3, $4)`,
    [token, repo.url, repo.display, ipHash]
  );
  return token;
}

export async function getFreeScan(token: string) {
  const { rows } = await pool.query(
    `SELECT share_token, repo_display, status, crit_count, high_count,
            med_count, low_count, findings, error, created_at, completed_at
     FROM free_scans WHERE share_token = $1`,
    [token]
  );
  return rows[0] ?? null;
}
