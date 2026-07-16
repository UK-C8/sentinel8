import { NextRequest, NextResponse } from "next/server";
import { generateAuditPack, getAuditPacks } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  const packs = await getAuditPacks(tenantId);
  return NextResponse.json({ packs });
}

export async function POST(req: NextRequest) {
  const { tenantId, framework, periodStart, periodEnd, generatedBy } = await req.json();
  if (!tenantId || !framework || !periodStart || !periodEnd) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  const pack = await generateAuditPack(
    tenantId, framework, periodStart, periodEnd,
    generatedBy ?? "system"
  );
  return NextResponse.json({ pack }, { status: 201 });
}
