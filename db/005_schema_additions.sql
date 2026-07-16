-- ============================================================
-- Phase 1 additions
-- ============================================================

-- Extra columns on findings needed by normalization layer
ALTER TABLE findings ADD COLUMN IF NOT EXISTS title       TEXT NOT NULL DEFAULT '';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS rule_id     TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS raw         JSONB;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL;

-- Connector-level audit log (separate from finding_events which has a NOT-NULL finding FK)
CREATE TABLE IF NOT EXISTS connector_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor        TEXT NOT NULL,
  event_type   TEXT NOT NULL, -- installed|scan_started|scan_completed|token_fetched|role_assumed|revoked|scan_failed
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE connector_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_events FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON connector_events
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON connector_events TO sentinel8_app;

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS findings_tenant_status_idx ON findings (tenant_id, status);
CREATE INDEX IF NOT EXISTS findings_tenant_severity_idx ON findings (tenant_id, severity);
CREATE INDEX IF NOT EXISTS scan_jobs_tenant_status_idx ON scan_jobs (tenant_id, status, scheduled_for DESC);
CREATE INDEX IF NOT EXISTS connector_events_connector_idx ON connector_events (connector_id, created_at DESC);
