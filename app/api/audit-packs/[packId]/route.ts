import { NextRequest, NextResponse } from "next/server";
import { approveAuditPack, markExported } from "@/lib/audit";
import { track } from "@/lib/analytics";
import pool from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ packId: string }> }
) {
  const { packId } = await params;
  const { action, approvedBy } = await req.json();

  if (action === "approve") {
    if (!approvedBy) return NextResponse.json({ error: "approvedBy required" }, { status: 400 });
    await approveAuditPack(packId, approvedBy);
    return NextResponse.json({ ok: true });
  }
  if (action === "export") {
    // FR-8: only approved packs may be exported
    const { rows } = await pool.query(
      `SELECT status, payload, tenant_id, framework FROM audit_packs WHERE id = $1`, [packId]
    );
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (rows[0].status !== "approved") {
      return NextResponse.json({ error: "Pack must be approved before export (FR-8)" }, { status: 403 });
    }
    await markExported(packId);
    await track("audit_pack_exported", rows[0].tenant_id, { packId, framework: rows[0].framework });
    return NextResponse.json({ payload: rows[0].payload });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
