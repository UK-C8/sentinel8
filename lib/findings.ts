import pool from "./db";

// Valid state machine transitions (FR-4, acceptance criteria)
const TRANSITIONS: Record<string, string[]> = {
  open:          ["triaged", "suppressed"],
  triaged:       ["fix_proposed", "accepted_risk", "suppressed"],
  fix_proposed:  ["fixed", "triaged"], // fixed only after scan_confirmed; triaged = fix rejected
  fixed:         ["open"],             // regression
  accepted_risk: ["open"],
  suppressed:    ["open"],
};

export async function transitionFinding(
  findingId: string,
  tenantId: string,
  targetStatus: string,
  actor: string,
  reason?: string
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL app.current_tenant_id = $1", [tenantId]);

    const { rows } = await client.query(
      "SELECT status FROM findings WHERE id = $1 FOR UPDATE",
      [findingId]
    );
    if (!rows.length) throw new Error("Finding not found");

    const current = rows[0].status as string;
    if (!TRANSITIONS[current]?.includes(targetStatus)) {
      throw new Error(`Invalid transition: ${current} → ${targetStatus}`);
    }

    // fixed status requires scan_confirmed event — checked by caller
    const eventType = targetStatus === "fixed" ? "fixed"
      : targetStatus === "suppressed" ? "suppressed"
      : targetStatus === "accepted_risk" ? "accepted_risk"
      : targetStatus === "triaged" ? "triaged"
      : targetStatus === "fix_proposed" ? "fix_proposed"
      : "reopened";

    await client.query(
      "UPDATE findings SET status = $1 WHERE id = $2",
      [targetStatus, findingId]
    );
    await client.query(
      `INSERT INTO finding_events (finding_id, actor, event_type, reason)
       VALUES ($1, $2, $3, $4)`,
      [findingId, actor, eventType, reason ?? null]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
