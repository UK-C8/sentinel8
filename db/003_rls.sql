-- ============================================================
-- Row-level security policies
-- Every tenant-scoped table enforces tenant_id server-side.
-- App queries must SET LOCAL app.current_tenant_id = '<uuid>'
-- in each transaction before touching these tables.
-- FORCE ROW LEVEL SECURITY ensures even the table owner is
-- subject to policies (superusers still bypass — use app role).
-- ============================================================

-- Application role — used at runtime and in tests (not a superuser)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'sentinel8_app') THEN
    CREATE ROLE sentinel8_app LOGIN PASSWORD 'change_in_prod';
  END IF;
END;
$$;

GRANT CONNECT ON DATABASE neondb TO sentinel8_app;
GRANT USAGE ON SCHEMA public TO sentinel8_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sentinel8_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sentinel8_app;

-- ── Enable + force RLS on all tenant-scoped tables ────────────
ALTER TABLE connectors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors        FORCE ROW LEVEL SECURITY;

ALTER TABLE findings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE findings          FORCE ROW LEVEL SECURITY;

ALTER TABLE finding_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE finding_events    FORCE ROW LEVEL SECURITY;

ALTER TABLE control_mappings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_mappings  FORCE ROW LEVEL SECURITY;

ALTER TABLE scan_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_jobs         FORCE ROW LEVEL SECURITY;

ALTER TABLE triage_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_embeddings FORCE ROW LEVEL SECURITY;

-- ── Policies ─────────────────────────────────────────────────
CREATE POLICY tenant_isolation ON connectors
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON findings
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON finding_events
  USING (
    finding_id IN (
      SELECT id FROM findings
      WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

CREATE POLICY tenant_isolation ON control_mappings
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON scan_jobs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON triage_embeddings
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
