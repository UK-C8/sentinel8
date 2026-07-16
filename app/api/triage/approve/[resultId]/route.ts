/**
 * POST /api/triage/approve/:resultId
 * Marks a triage result as human-approved (clears provisional banner).
 * CLAUDE.md §4: AI-generated marker stays until human approves.
 */
import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ resultId: string }> }
) {
  const body = await req.json();
  const { approvedBy } = body;
  if (!approvedBy) return NextResponse.json({ error: "approvedBy required" }, { status: 400 });

  const { resultId } = await params;
  const { rowCount } = await pool.query(
    `UPDATE triage_results
     SET approved_by = $1, approved_at = now()
     WHERE id = $2 AND approved_at IS NULL`,
    [approvedBy, resultId]
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "not found or already approved" }, { status: 404 });
  }
  return NextResponse.json({ approved: true });
}
