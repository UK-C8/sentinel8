/**
 * POST /api/fix-pr/:findingId
 * Creates a draft-only fix PR via GitHub App (FR-6).
 * Never auto-merges — draft:true is structural, not a flag.
 */
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { createFixPR } from "@/lib/fix-pr";
import { track } from "@/lib/analytics";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> }
) {
  const body = await req.json().catch(() => ({}));
  const tenantId = body.tenantId ?? process.env.CENTR8_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const { findingId } = await params;
  const { rows } = await pool.query(
    "SELECT * FROM findings WHERE id = $1 AND tenant_id = $2",
    [findingId, tenantId]
  );
  const finding = rows[0];
  if (!finding) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (finding.fix_pr_url) {
    return NextResponse.json({ pr_url: finding.fix_pr_url, pr_number: finding.fix_pr_number, existing: true });
  }

  const result = await createFixPR(finding);

  // Transition to fix_proposed via findings state machine
  await pool.query(
    `UPDATE findings SET status = 'fix_proposed' WHERE id = $1 AND status IN ('open','triaged')`,
    [finding.id]
  );
  await pool.query(
    `INSERT INTO finding_events (finding_id, actor, event_type, reason)
     VALUES ($1, 'system', 'fix_proposed', $2)`,
    [finding.id, `Draft PR #${result.pr_number} created`]
  );

  await track("fix_pr_proposed", tenantId, { findingId: finding.id, pr_number: result.pr_number });

  return NextResponse.json(result);
}
