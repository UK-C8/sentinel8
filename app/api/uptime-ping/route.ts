import { NextRequest, NextResponse } from "next/server";
import { recordUptimeCheck } from "@/lib/uptime";

// Called by Vercel Cron every 5 minutes — pings self to measure latency
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    // Control plane: this endpoint itself responding = up
    await recordUptimeCheck("control_plane", "up", Date.now() - start);
    return NextResponse.json({ ok: true });
  } catch (err) {
    await recordUptimeCheck("control_plane", "down", undefined, String(err));
    return NextResponse.json({ error: "ping failed" }, { status: 500 });
  }
}
