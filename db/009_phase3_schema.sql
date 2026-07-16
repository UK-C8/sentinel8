-- ============================================================
-- Phase 3: status page, audit packs, notification settings
-- ============================================================

-- ── uptime_checks (custom Prometheus substitute per CLAUDE.md §2) ─────
CREATE TABLE IF NOT EXISTS uptime_checks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service      TEXT NOT NULL,          -- 'control_plane' | 'scan_pipeline' | 'ai_triage'
  status       TEXT NOT NULL CHECK (status IN ('up','degraded','down')),
  latency_ms   INTEGER,
  detail       TEXT,
  checked_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uptime_checks_service_time_idx ON uptime_checks (service, checked_at DESC);

-- ── incidents (public-facing incident history) ────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        TEXT NOT NULL,
  impact       TEXT NOT NULL CHECK (impact IN ('none','minor','major','critical')),
  status       TEXT NOT NULL CHECK (status IN ('investigating','identified','monitoring','resolved')),
  body         TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── audit_packs (track exports; FR-8 human-review gate) ──────────────
CREATE TABLE IF NOT EXISTS audit_packs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework       compliance_framework NOT NULL,
  generated_by    TEXT NOT NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  findings_count  INTEGER NOT NULL DEFAULT 0,
  controls_count  INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','approved','exported')),
  approved_by     TEXT,
  approved_at     TIMESTAMPTZ,
  payload         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE audit_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_packs FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON audit_packs
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON audit_packs TO sentinel8_app;

-- ── notification_settings (per-tenant, Could-priority FR-12) ─────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  slack_webhook   TEXT,
  email_to        TEXT[],
  notify_critical BOOLEAN NOT NULL DEFAULT true,
  notify_high     BOOLEAN NOT NULL DEFAULT false,
  notify_sla      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON notification_settings
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON notification_settings TO sentinel8_app;

-- ── posture_snapshots (daily score history for trend chart) ──────────
CREATE TABLE IF NOT EXISTS posture_snapshots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  score       NUMERIC(5,2) NOT NULL,   -- 0–100
  open_critical INTEGER NOT NULL DEFAULT 0,
  open_high     INTEGER NOT NULL DEFAULT 0,
  open_medium   INTEGER NOT NULL DEFAULT 0,
  open_low      INTEGER NOT NULL DEFAULT 0,
  snapped_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (tenant_id, snapped_at)
);
ALTER TABLE posture_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE posture_snapshots FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON posture_snapshots
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON posture_snapshots TO sentinel8_app;
