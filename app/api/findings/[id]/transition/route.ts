import { NextRequest, NextResponse } from "next/server";
import { transitionFinding } from "@/lib/findings";

// POST body: { tenantId, targetStatus, actor, reason? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { tenantId, targetStatus, actor, reason } = await req.json() as {
    tenantId: string;
    targetStatus: string;
    actor: string;
    reason?: string;
  };

  try {
    await transitionFinding(id, tenantId, targetStatus, actor, reason);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
