-- ============================================================
-- Sentinel8 — core schema
-- Run against the direct (non-pooled) Neon connection string.
-- ============================================================

-- ── tenants ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  region      TEXT NOT NULL DEFAULT 'us',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── connectors ───────────────────────────────────────────────
CREATE TYPE connector_provider AS ENUM ('github','gitlab','aws','gcp','azure');

CREATE TABLE IF NOT EXISTS connectors (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider       connector_provider NOT NULL,
  scope          TEXT NOT NULL,          -- e.g. "repo:read" or ARN prefix
  read_only      BOOLEAN NOT NULL DEFAULT true,
  credential_ref TEXT NOT NULL,          -- pointer to secret store key, never the secret itself
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at     TIMESTAMPTZ
);

-- ── findings ─────────────────────────────────────────────────
CREATE TYPE finding_type AS ENUM ('cve','secret','misconfig','iam_drift','public_bucket');
CREATE TYPE finding_severity AS ENUM ('critical','high','medium','low','informational');
CREATE TYPE finding_status AS ENUM ('open','triaged','fix_proposed','fixed','accepted_risk','suppressed');

CREATE TABLE IF NOT EXISTS findings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type           finding_type NOT NULL,
  severity       finding_severity NOT NULL,
  asset          TEXT NOT NULL,
  fingerprint    TEXT NOT NULL,          -- dedup key; unique per tenant
  status         finding_status NOT NULL DEFAULT 'open',
  first_seen     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen      TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_scanner TEXT NOT NULL,
  UNIQUE (tenant_id, fingerprint)
);

-- ── finding_events ────────────────────────────────────────────
CREATE TYPE finding_event_type AS ENUM (
  'opened','triaged','fix_proposed','fix_approved','fixed',
  'accepted_risk','suppressed','reopened','scan_confirmed'
);

CREATE TABLE IF NOT EXISTS finding_events (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id  UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  actor       TEXT NOT NULL,            -- user email or "system"
  event_type  finding_event_type NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── control_mappings ─────────────────────────────────────────
CREATE TYPE compliance_framework AS ENUM ('soc2','gdpr','dpdp');
CREATE TYPE control_status AS ENUM ('met','gap','na');

CREATE TABLE IF NOT EXISTS control_mappings (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework    compliance_framework NOT NULL,
  control_id   TEXT NOT NULL,           -- e.g. "CC6.1" or "Art.32"
  finding_id   UUID REFERENCES findings(id) ON DELETE SET NULL,
  status       control_status NOT NULL DEFAULT 'gap',
  evidence_ref TEXT                     -- pointer to stored evidence artifact
);

-- ── scan_jobs (Postgres-backed job queue, replaces Temporal) ──
CREATE TYPE scan_job_status AS ENUM ('pending','running','completed','failed');

CREATE TABLE IF NOT EXISTS scan_jobs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  connector_id  UUID NOT NULL REFERENCES connectors(id) ON DELETE CASCADE,
  status        scan_job_status NOT NULL DEFAULT 'pending',
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  locked_by     TEXT,                   -- worker instance id
  locked_at     TIMESTAMPTZ
);

-- ── triage_embeddings (pgvector RAG corpus, per-tenant) ───────
CREATE TABLE IF NOT EXISTS triage_embeddings (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  finding_id  UUID REFERENCES findings(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,            -- chunk text
  embedding   vector(1536),             -- text-embedding-3-small dimensions
  source_ref  TEXT,                     -- CVE ID / rule ID / doc ref
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ANN index — build after bulk insert, not before
CREATE INDEX IF NOT EXISTS triage_embeddings_tenant_idx ON triage_embeddings (tenant_id);
