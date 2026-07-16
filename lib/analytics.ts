/**
 * Server-side PostHog capture. No SDK — PostHog's /capture is a plain POST.
 * No-ops when POSTHOG_KEY is unset, so dev/CI don't need PostHog.
 *
 * Full funnel + event list per PRD (FR-11 / analytics section).
 */

export type AnalyticsEvent =
  // Funnel
  | "free_scan_started"
  | "free_scan_completed"
  | "tenant_created"
  | "retainer_activated"
  // Product events
  | "connector_added"
  | "scan_started"
  | "scan_completed"
  | "finding_opened"
  | "finding_resolved"
  | "triage_generated"
  | "fix_pr_proposed"
  | "fix_pr_merged"
  | "control_mapped"
  | "audit_pack_exported"
  | "sla_breach";

const HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

export async function track(
  event: AnalyticsEvent,
  distinctId: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const key = process.env.POSTHOG_KEY;
  if (!key) return; // no-op without a project key
  try {
    await fetch(`${HOST}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        distinct_id: distinctId,
        properties: { ...properties, $lib: "sentinel8-server" },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // analytics must never break the request path
  }
}
