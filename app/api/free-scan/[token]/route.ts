import { NextRequest, NextResponse } from "next/server";
import { getFreeScan } from "@/lib/free-scan";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const scan = await getFreeScan(token);
  if (!scan) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

  const total = scan.crit_count + scan.high_count + scan.med_count + scan.low_count;
  // Self-serve free tool: return the full sanitized findings list (no gating).
  return NextResponse.json({
    repo: scan.repo_display,
    status: scan.status,
    counts: {
      critical: scan.crit_count,
      high: scan.high_count,
      medium: scan.med_count,
      low: scan.low_count,
      total,
    },
    findings: scan.findings,   // [{ severity, scanner, type, title, rule_id, asset }]
    error: scan.error,
    createdAt: scan.created_at,
    completedAt: scan.completed_at,
  });
}
