import pool from "./db";

export async function enqueueJob(
  tenantId: string,
  connectorId: string,
  scheduledFor: Date = new Date()
): Promise<string> {
  const { rows } = await pool.query(
    `INSERT INTO scan_jobs (tenant_id, connector_id, scheduled_for)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, connectorId, scheduledFor]
  );
  return rows[0].id as string;
}

export async function enqueueAllActiveConnectors(): Promise<number> {
  const { rows } = await pool.query(
    `INSERT INTO scan_jobs (tenant_id, connector_id)
     SELECT tenant_id, id FROM connectors WHERE revoked_at IS NULL
     RETURNING id`
  );
  return rows.length;
}
