import { NextResponse } from "next/server";
import { enqueueAllActiveConnectors } from "@/lib/queue";

// Vercel Cron hits this daily at 02:00 UTC (vercel.json)
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const count = await enqueueAllActiveConnectors();
  return NextResponse.json({ enqueued: count });
}
