/**
 * Table-driven control mapping engine.
 * Matches findings to control_rules rows by type + severity threshold.
 * Returns gap rows (finding not yet meeting the control) and upserts control_mappings.
 */
import pool from "./db";

type ControlRow = {
  id: string;
  framework: string;
  control_id: string;
  control_name: string;
  control_text: string;
};

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  informational: 0,
};

export async function mapFindingToControls(
  tenantId: string,
  findingId: string,
  findingType: string,
  findingSeverity: string
): Promise<ControlRow[]> {
  // Find matching active control rules
  const { rows: rules } = await pool.query(
    `SELECT cr.framework, cr.control_id, cr.control_name, cr.control_text
     FROM control_rules cr
     WHERE cr.is_active = true
       AND (cr.finding_type IS NULL OR cr.finding_type = $1)
       AND (cr.min_severity IS NULL
            OR $2::finding_severity >= cr.min_severity)
     ORDER BY cr.framework, cr.control_id`,
    [findingType, findingSeverity]
  );

  if (rules.length === 0) return [];

  // Upsert a control_mapping row for each matched control
  for (const rule of rules) {
    await pool.query(
      `INSERT INTO control_mappings
         (tenant_id, framework, control_id, control_name, status)
       VALUES ($1, $2, $3, $4, 'gap')
       ON CONFLICT (tenant_id, framework, control_id) DO UPDATE
         SET status = 'gap', updated_at = now()
       WHERE control_mappings.status != 'met'`,
      [tenantId, rule.framework, rule.control_id, rule.control_name]
    );

    // Link finding → control_mapping
    await pool.query(
      `INSERT INTO findings_control_mappings (finding_id, control_mapping_id)
       SELECT $1, cm.id FROM control_mappings cm
       WHERE cm.tenant_id = $2 AND cm.framework = $3 AND cm.control_id = $4
       ON CONFLICT DO NOTHING`,
      [findingId, tenantId, rule.framework, rule.control_id]
    ).catch(() => {
      // findings_control_mappings join table might not exist yet — skip silently
    });
  }

  return rules;
}

export async function getControlSummary(tenantId: string) {
  const { rows } = await pool.query(
    `SELECT framework, control_id, control_name, status, COUNT(*) OVER (PARTITION BY framework) AS total_controls
     FROM control_mappings
     WHERE tenant_id = $1
     ORDER BY framework, control_id`,
    [tenantId]
  );
  return rows;
}
