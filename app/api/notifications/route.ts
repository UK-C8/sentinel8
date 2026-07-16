import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get("tenantId");
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  const { rows } = await pool.query(
    `SELECT * FROM notification_settings WHERE tenant_id = $1`, [tenantId]
  );
  return NextResponse.json({ settings: rows[0] ?? null });
}

export async function PUT(req: NextRequest) {
  const { tenantId, slackWebhook, emailTo, notifyCritical, notifyHigh, notifySla } = await req.json();
  if (!tenantId) return NextResponse.json({ error: "tenantId required" }, { status: 400 });

  await pool.query(
    `INSERT INTO notification_settings
       (tenant_id, slack_webhook, email_to, notify_critical, notify_high, notify_sla)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id) DO UPDATE SET
       slack_webhook   = EXCLUDED.slack_webhook,
       email_to        = EXCLUDED.email_to,
       notify_critical = EXCLUDED.notify_critical,
       notify_high     = EXCLUDED.notify_high,
       notify_sla      = EXCLUDED.notify_sla,
       updated_at      = now()`,
    [tenantId, slackWebhook ?? null, emailTo ?? null, notifyCritical ?? true, notifyHigh ?? false, notifySla ?? true]
  );
  return NextResponse.json({ ok: true });
}
