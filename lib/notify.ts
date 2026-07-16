import pool from "./db";

interface NotifyPayload {
  tenantId: string;
  subject: string;
  body: string;
  severity?: string;
}

export async function sendNotifications(payload: NotifyPayload) {
  const { rows } = await pool.query(
    `SELECT * FROM notification_settings WHERE tenant_id = $1`,
    [payload.tenantId]
  );
  if (!rows.length) return;
  const cfg = rows[0];

  const sev = payload.severity ?? "low";
  const shouldNotify =
    (sev === "critical" && cfg.notify_critical) ||
    (sev === "high" && cfg.notify_high);
  if (!shouldNotify) return;

  const tasks: Promise<void>[] = [];

  if (cfg.slack_webhook) {
    tasks.push(
      fetch(cfg.slack_webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `*${payload.subject}*\n${payload.body}` }),
      }).then(() => {})
    );
  }

  if (cfg.email_to?.length && process.env.RESEND_API_KEY) {
    tasks.push(
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "Sentinel8 <alerts@sentinel8.centr8.io>",
          to: cfg.email_to,
          subject: payload.subject,
          text: payload.body,
        }),
      }).then(() => {})
    );
  }

  await Promise.allSettled(tasks);
}
