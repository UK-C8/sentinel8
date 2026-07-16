import pool from "./db";

export type AuditPackStatus = "draft" | "approved" | "exported";

export async function generateAuditPack(
  tenantId: string,
  framework: string,
  periodStart: string,
  periodEnd: string,
  generatedBy: string
) {
  // Fetch findings + control mappings for the framework
  const { rows: findings } = await pool.query(
    `SELECT f.id, f.title, f.severity, f.status, f.type AS finding_type, f.asset AS asset_name,
            f.first_seen, f.last_seen, tr.priority, tr.explanation
     FROM findings f
     LEFT JOIN triage_results tr ON tr.finding_id = f.id AND tr.approved_at IS NOT NULL
     WHERE f.tenant_id = $1
       AND f.first_seen BETWEEN $2 AND $3
     ORDER BY f.severity, f.last_seen DESC`,
    [tenantId, periodStart, periodEnd]
  );

  const { rows: controls } = await pool.query(
    `SELECT DISTINCT cm.control_id, cm.control_name, cm.framework, cm.status
     FROM control_mappings cm
     WHERE cm.tenant_id = $1 AND cm.framework = $2`,
    [tenantId, framework]
  );

  const payload = {
    generated_at: new Date().toISOString(),
    framework,
    period: { start: periodStart, end: periodEnd },
    findings,
    controls,
  };

  const { rows } = await pool.query(
    `INSERT INTO audit_packs
       (tenant_id, framework, generated_by, period_start, period_end,
        findings_count, controls_count, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      tenantId, framework, generatedBy, periodStart, periodEnd,
      findings.length, controls.length, JSON.stringify(payload),
    ]
  );
  return { id: rows[0].id as string, payload };
}

export async function approveAuditPack(packId: string, approvedBy: string) {
  await pool.query(
    `UPDATE audit_packs SET status = 'approved', approved_by = $2, approved_at = now()
     WHERE id = $1 AND status = 'draft'`,
    [packId, approvedBy]
  );
}

export async function markExported(packId: string) {
  await pool.query(
    `UPDATE audit_packs SET status = 'exported' WHERE id = $1 AND status = 'approved'`,
    [packId]
  );
}

export async function getAuditPacks(tenantId: string) {
  const { rows } = await pool.query(
    `SELECT id, framework, generated_by, period_start, period_end,
            findings_count, controls_count, status, approved_by, approved_at, created_at
     FROM audit_packs WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );
  return rows;
}
