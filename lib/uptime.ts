import pool from "./db";

export type ServiceName = "control_plane" | "scan_pipeline" | "ai_triage";

export async function recordUptimeCheck(
  service: ServiceName,
  status: "up" | "degraded" | "down",
  latencyMs?: number,
  detail?: string
) {
  await pool.query(
    `INSERT INTO uptime_checks (service, status, latency_ms, detail) VALUES ($1, $2, $3, $4)`,
    [service, status, latencyMs ?? null, detail ?? null]
  );
}

export async function getRecentStatus() {
  // Latest status per service
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (service) service, status, latency_ms, detail, checked_at
     FROM uptime_checks ORDER BY service, checked_at DESC`
  );
  return rows as Array<{
    service: string;
    status: string;
    latency_ms: number | null;
    detail: string | null;
    checked_at: string;
  }>;
}

export async function getUptimePct(service: ServiceName, days = 30): Promise<number> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'up') AS up_count,
       COUNT(*) AS total
     FROM uptime_checks
     WHERE service = $1 AND checked_at >= now() - ($2::int * interval '1 day')`,
    [service, days]
  );
  const { up_count, total } = rows[0];
  if (!total || Number(total) === 0) return 100;
  return Math.round((Number(up_count) / Number(total)) * 1000) / 10;
}

export async function getIncidents() {
  const { rows } = await pool.query(
    `SELECT id, title, impact, status, body, started_at, resolved_at
     FROM incidents ORDER BY started_at DESC LIMIT 20`
  );
  return rows;
}
