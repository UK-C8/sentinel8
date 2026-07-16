import { NextResponse } from "next/server";
import { getRecentStatus, getUptimePct, getIncidents } from "@/lib/uptime";

export const revalidate = 60;

export async function GET() {
  const [services, incidents] = await Promise.all([
    getRecentStatus(),
    getIncidents(),
  ]);

  const uptime = await Promise.all(
    (["control_plane", "scan_pipeline", "ai_triage"] as const).map(async (svc) => ({
      service: svc,
      uptime_30d: await getUptimePct(svc, 30),
    }))
  );

  return NextResponse.json({ services, uptime, incidents });
}
