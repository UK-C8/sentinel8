/**
 * POST /api/triage/:findingId
 * Runs Claude triage on a finding, caches result in triage_results.
 * FR-5: citations required (enforced in lib/claude.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { triageFinding } from "@/lib/claude";
import { mapFindingToControls } from "@/lib/control-mapping";
import { storeContext } from "@/lib/rag";
import { track } from "@/lib/analytics";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const { findingId } = await params;
  const body = await req.json().catch(() => ({}));
  const tenantId = body.tenantId ?? process.env.CENTR8_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  // Check for cached result
  const cached = await pool.query(
    "SELECT * FROM triage_results WHERE finding_id = $1",
    [findingId]
  );
  if (cached.rows[0]) {
    return NextResponse.json({ result: cached.rows[0], cached: true });
  }

  const { rows } = await pool.query(
    "SELECT * FROM findings WHERE id = $1 AND tenant_id = $2",
    [findingId, tenantId]
  );
  const finding = rows[0];
  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Map to controls first — use control text as RAG context for triage
  const controls = await mapFindingToControls(
    tenantId,
    findingId,
    finding.type,
    finding.severity
  );
  const controlContext = controls.map((c) => `${c.framework} ${c.control_id}: ${c.control_text}`).join("\n\n");

  const triage = await triageFinding(tenantId, findingId, {
    type: finding.type,
    severity: finding.severity,
    title: finding.title,
    rule_id: finding.rule_id,
    asset: finding.asset,
    raw: finding.raw,
  }, controlContext);

  // Cache result
  const { rows: saved } = await pool.query(
    `INSERT INTO triage_results
       (finding_id, tenant_id, explanation, priority, confidence, citations, raw_response, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (finding_id) DO UPDATE
       SET explanation = EXCLUDED.explanation,
           priority = EXCLUDED.priority,
           confidence = EXCLUDED.confidence,
           citations = EXCLUDED.citations,
           raw_response = EXCLUDED.raw_response,
           model = EXCLUDED.model
     RETURNING *`,
    [
      findingId, tenantId,
      triage.explanation, triage.priority, triage.confidence,
      JSON.stringify(triage.citations), JSON.stringify(triage.raw_response), triage.model,
    ]
  );

  // Link triage result back to finding
  await pool.query(
    "UPDATE findings SET triage_result_id = $1 WHERE id = $2",
    [saved[0].id, findingId]
  );

  // Store context for future RAG retrieval
  await storeContext(
    tenantId,
    findingId,
    `${finding.title} ${finding.type} ${finding.rule_id ?? ""} ${triage.explanation}`
  );

  // Transition finding to triaged
  await pool.query(
    `UPDATE findings SET status = 'triaged' WHERE id = $1 AND status = 'open'`,
    [findingId]
  );

  await track("triage_generated", tenantId, { findingId, priority: triage.priority, confidence: triage.confidence });
  if (controls.length > 0) {
    await track("control_mapped", tenantId, { findingId, count: controls.length });
  }

  return NextResponse.json({ result: saved[0], controls_mapped: controls.length });
}
