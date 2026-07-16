import pool from "./db";

export interface PostureScore {
  score: number;
  open_critical: number;
  open_high: number;
  open_medium: number;
  open_low: number;
}

export interface TrendPoint {
  snapped_at: string;
  score: number;
}

export interface ControlCoverage {
  framework: string;
  total_controls: number;
  mapped_controls: number;
  coverage_pct: number;
}

export async function computePostureScore(tenantId: string): Promise<PostureScore> {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE severity::text = 'critical' AND status::text NOT IN ('fixed','accepted_risk','suppressed')) AS open_critical,
       COUNT(*) FILTER (WHERE severity::text = 'high'     AND status::text NOT IN ('fixed','accepted_risk','suppressed')) AS open_high,
       COUNT(*) FILTER (WHERE severity::text = 'medium'   AND status::text NOT IN ('fixed','accepted_risk','suppressed')) AS open_medium,
       COUNT(*) FILTER (WHERE severity::text = 'low'      AND status::text NOT IN ('fixed','accepted_risk','suppressed')) AS open_low
     FROM findings WHERE tenant_id = $1`,
    [tenantId]
  );
  const r = rows[0];
  const crit = Number(r.open_critical);
  const high = Number(r.open_high);
  const med  = Number(r.open_medium);
  const low  = Number(r.open_low);
  // Simple weighted penalty: critical=10, high=5, medium=2, low=1 — capped at 100 points off
  const penalty = Math.min(100, crit * 10 + high * 5 + med * 2 + low * 1);
  const score = Math.max(0, 100 - penalty);
  return { score, open_critical: crit, open_high: high, open_medium: med, open_low: low };
}

export async function snapshotPosture(tenantId: string): Promise<void> {
  const p = await computePostureScore(tenantId);
  await pool.query(
    `INSERT INTO posture_snapshots (tenant_id, score, open_critical, open_high, open_medium, open_low)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, snapped_at) DO UPDATE
       SET score = EXCLUDED.score,
           open_critical = EXCLUDED.open_critical,
           open_high = EXCLUDED.open_high,
           open_medium = EXCLUDED.open_medium,
           open_low = EXCLUDED.open_low`,
    [tenantId, p.score, p.open_critical, p.open_high, p.open_medium, p.open_low]
  );
}

export async function getPostureTrend(tenantId: string, days = 30): Promise<TrendPoint[]> {
  const { rows } = await pool.query(
    `SELECT snapped_at::text, score FROM posture_snapshots
     WHERE tenant_id = $1 AND snapped_at >= CURRENT_DATE - $2::int
     ORDER BY snapped_at ASC`,
    [tenantId, days]
  );
  return rows as TrendPoint[];
}

export async function getControlCoverage(tenantId: string): Promise<ControlCoverage[]> {
  const { rows } = await pool.query(
    `SELECT
       cm.framework,
       COUNT(DISTINCT cm.control_id) AS mapped_controls,
       (SELECT COUNT(*) FROM control_rules cr WHERE cr.framework = cm.framework) AS total_controls
     FROM control_mappings cm
     WHERE cm.tenant_id = $1
     GROUP BY cm.framework`,
    [tenantId]
  );
  return rows.map((r) => ({
    framework: r.framework as string,
    total_controls: Number(r.total_controls),
    mapped_controls: Number(r.mapped_controls),
    coverage_pct: r.total_controls > 0
      ? Math.round((r.mapped_controls / r.total_controls) * 100)
      : 0,
  }));
}
