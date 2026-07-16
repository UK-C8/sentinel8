import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { enqueueJob } from "@/lib/queue";
import { track } from "@/lib/analytics";

// GitHub App redirect after install:
// GET /api/connectors/github/callback?installation_id=...&setup_action=install
//
// For Phase 1 internal dogfood, tenant is taken from CENTR8_TENANT_ID env var.
// Phase 3 will derive tenant from the authenticated session.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const installationId = searchParams.get("installation_id");
  const setupAction = searchParams.get("setup_action");

  if (!installationId) {
    return NextResponse.json({ error: "missing installation_id" }, { status: 400 });
  }
  // GitHub sends setup_action=install on first install, update on permission changes
  if (!setupAction || !["install", "update", "request"].includes(setupAction)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const tenantId = process.env.CENTR8_TENANT_ID;
  if (!tenantId) return NextResponse.json({ error: "CENTR8_TENANT_ID not set" }, { status: 500 });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `INSERT INTO connectors (tenant_id, provider, scope, read_only, credential_ref)
       VALUES ($1, 'github', 'contents:read,metadata:read,security_events:read', true, $2)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [tenantId, installationId]
    );

    // Already installed (no rows returned by INSERT ... ON CONFLICT DO NOTHING)
    const connectorId = rows[0]?.id ?? (await client.query(
      "SELECT id FROM connectors WHERE tenant_id=$1 AND credential_ref=$2",
      [tenantId, installationId]
    )).rows[0]?.id;

    // Audit log
    await client.query(
      `INSERT INTO connector_events (connector_id, tenant_id, actor, event_type, metadata)
       VALUES ($1, $2, 'system', 'installed', $3)`,
      [connectorId, tenantId, JSON.stringify({ installation_id: installationId })]
    );

    await client.query("COMMIT");

    // Enqueue an immediate scan so the dashboard populates within 10 minutes
    await enqueueJob(tenantId, connectorId);

    await track("connector_added", tenantId, { provider: "github" });

    return NextResponse.redirect(new URL("/dashboard", req.url));
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
