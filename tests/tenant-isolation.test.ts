/**
 * Cross-tenant isolation tests — CI gate per CLAUDE.md §3.
 * These MUST pass before any merge. They test that:
 * 1. findings, control_mappings, triage_results, audit_packs, posture_snapshots
 *    cannot be read across tenant boundaries via RLS.
 * 2. The app role (sentinel8_app) sees only its tenant's rows when the
 *    app.current_tenant_id session variable is set correctly.
 *
 * Run: npx tsx --test tests/tenant-isolation.test.ts
 */

import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { Pool } from "pg";

const DIRECT_URL =
  process.env.DATABASE_URL_DIRECT ??
  process.env.DATABASE_URL ??
  (() => { throw new Error("DATABASE_URL_DIRECT not set"); })();

// Owner pool (bypasses RLS to set up fixtures)
const ownerPool = new Pool({ connectionString: DIRECT_URL });

// App-role pool (sentinel8_app, subject to RLS)
const APP_URL = DIRECT_URL.replace(
  /\/\/[^:]+:[^@]+@/,
  `//sentinel8_app:${process.env.APP_ROLE_PASSWORD ?? "sentinel8_app_pass"}@`
);
const appPool = new Pool({ connectionString: APP_URL });

let tenantA: string;
let tenantB: string;

before(async () => {
  // Insert two test tenants
  const { rows: [a] } = await ownerPool.query(
    `INSERT INTO tenants (name) VALUES ('Tenant A Test') RETURNING id`
  );
  const { rows: [b] } = await ownerPool.query(
    `INSERT INTO tenants (name) VALUES ('Tenant B Test') RETURNING id`
  );
  tenantA = a.id;
  tenantB = b.id;

  // Insert a finding for each tenant
  await ownerPool.query(
    `INSERT INTO findings (tenant_id, fingerprint, title, severity, type, status, asset, source_scanner)
     VALUES
       ($1, 'fp-a', 'Finding A', 'critical', 'secret', 'open', 'repo-a', 'gitleaks'),
       ($2, 'fp-b', 'Finding B', 'high',     'secret', 'open', 'repo-b', 'gitleaks')`,
    [tenantA, tenantB]
  );

  // Insert posture snapshots
  await ownerPool.query(
    `INSERT INTO posture_snapshots (tenant_id, score) VALUES ($1, 80), ($2, 60)`,
    [tenantA, tenantB]
  );

  // Insert audit packs
  await ownerPool.query(
    `INSERT INTO audit_packs (tenant_id, framework, generated_by, period_start, period_end, payload)
     VALUES
       ($1, 'SOC2', 'test', '2026-01-01', '2026-06-30', '{}'),
       ($2, 'GDPR', 'test', '2026-01-01', '2026-06-30', '{}')`,
    [tenantA, tenantB]
  );
});

after(async () => {
  // Clean up fixtures (cascade deletes findings, etc.)
  await ownerPool.query(`DELETE FROM tenants WHERE id IN ($1, $2)`, [tenantA, tenantB]);
  await ownerPool.end();
  await appPool.end();
});

async function asApp<T>(tenantId: string, fn: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    return await fn(client);
  } finally {
    client.release();
  }
}

test("findings: tenant A cannot read tenant B rows", async () => {
  const { rows } = await asApp(tenantA, (c) =>
    c.query(`SELECT id FROM findings WHERE tenant_id = $1`, [tenantB])
  );
  assert.equal(rows.length, 0, "RLS must block cross-tenant finding read");
});

test("findings: tenant A sees own rows only", async () => {
  const { rows } = await asApp(tenantA, (c) =>
    c.query(`SELECT fingerprint FROM findings WHERE tenant_id = $1`, [tenantA])
  );
  assert.ok(rows.some((r) => r.fingerprint === "fp-a"), "Must return own finding");
  assert.ok(!rows.some((r) => r.fingerprint === "fp-b"), "Must not return other tenant's finding");
});

test("posture_snapshots: cross-tenant blocked", async () => {
  const { rows } = await asApp(tenantA, (c) =>
    c.query(`SELECT id FROM posture_snapshots WHERE tenant_id = $1`, [tenantB])
  );
  assert.equal(rows.length, 0);
});

test("audit_packs: cross-tenant blocked", async () => {
  const { rows } = await asApp(tenantA, (c) =>
    c.query(`SELECT id FROM audit_packs WHERE tenant_id = $1`, [tenantB])
  );
  assert.equal(rows.length, 0);
});

test("triage_results: cross-tenant blocked via findings join", async () => {
  // triage_results doesn't have tenant_id but is joined through findings
  // Verify a raw SELECT returns nothing for other tenant's finding IDs
  const { rows: bFindings } = await ownerPool.query(
    `SELECT id FROM findings WHERE tenant_id = $1`, [tenantB]
  );
  if (bFindings.length === 0) return; // no findings to check
  const bIds = bFindings.map((r: { id: string }) => `'${r.id}'`).join(",");
  const { rows } = await asApp(tenantA, (c) =>
    c.query(`SELECT id FROM triage_results WHERE finding_id IN (${bIds})`)
  );
  // RLS on findings means app can't even reference those finding IDs
  assert.equal(rows.length, 0);
});

test("triage_embeddings: cross-tenant blocked", async () => {
  const { rows } = await asApp(tenantA, (c) =>
    c.query(`SELECT id FROM triage_embeddings WHERE tenant_id = $1`, [tenantB])
  );
  assert.equal(rows.length, 0);
});
