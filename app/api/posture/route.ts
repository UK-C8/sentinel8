import { NextRequest, NextResponse } from "next/server";
import { computePostureScore, getPostureTrend, getControlCoverage, snapshotPosture } from "@/lib/posture";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  const [score, trend, coverage] = await Promise.all([
    computePostureScore(tenantId),
    getPostureTrend(tenantId, 30),
    getControlCoverage(tenantId),
  ]);

  // Snapshot today's score
  await snapshotPosture(tenantId);

  // Remediation queue: open findings sorted by severity priority
  const { rows: queue } = await pool.query(
    `SELECT id, title, severity, status, type AS finding_type, asset AS asset_name, last_seen AS last_seen_at
     FROM findings
     WHERE tenant_id = $1 AND status::text NOT IN ('fixed','accepted_risk','suppressed')
     ORDER BY
       CASE severity
         WHEN 'critical' THEN 1 WHEN 'high' THEN 2
         WHEN 'medium'   THEN 3 ELSE 4
       END,
       last_seen DESC
     LIMIT 50`,
    [tenantId]
  );

  return NextResponse.json({ score, trend, coverage, queue });
}
