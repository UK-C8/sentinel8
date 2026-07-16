-- ============================================================
-- Phase 2: control mapping, triage, token tracking, evidence
-- ============================================================

-- ── control_rules (editable mapping table, not hardcoded) ────
CREATE TABLE IF NOT EXISTS control_rules (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  framework    compliance_framework NOT NULL,
  control_id   TEXT NOT NULL,
  control_name TEXT NOT NULL,
  control_text TEXT NOT NULL,          -- full control description, used as RAG context
  finding_type finding_type,           -- NULL = any type triggers gap
  min_severity finding_severity,       -- NULL = any severity triggers gap
  scanner      TEXT,                   -- NULL = any scanner
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS control_rules_framework_idx ON control_rules (framework, control_id);

-- ── triage_results (cached AI output per finding) ────────────
CREATE TABLE IF NOT EXISTS triage_results (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  finding_id    UUID NOT NULL REFERENCES findings(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  explanation   TEXT NOT NULL,
  priority      TEXT NOT NULL CHECK (priority IN ('immediate','high','medium','low')),
  confidence    NUMERIC(3,2) NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  citations     JSONB NOT NULL,        -- [{rule_id, source, url?}] — min 1 required (FR-5)
  raw_response  JSONB,
  model         TEXT NOT NULL,
  -- Human review fields (FR-5 / CLAUDE.md §4 provisional banner)
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (finding_id)
);

ALTER TABLE triage_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE triage_results FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON triage_results
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON triage_results TO sentinel8_app;

-- ── api_usage (token cost tracking per tenant) ───────────────
CREATE TABLE IF NOT EXISTS api_usage (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model         TEXT NOT NULL,
  input_tokens  INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd      NUMERIC(10,6) NOT NULL,
  operation     TEXT NOT NULL,         -- triage|embedding|fix_pr|evidence
  finding_id    UUID REFERENCES findings(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_usage
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
GRANT SELECT, INSERT ON api_usage TO sentinel8_app;

CREATE INDEX IF NOT EXISTS api_usage_tenant_month_idx
  ON api_usage (tenant_id, date_trunc('month', created_at));

-- ── evidence_drafts (per-control evidence artifacts) ─────────
CREATE TABLE IF NOT EXISTS evidence_drafts (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  control_mapping_id  UUID NOT NULL REFERENCES control_mappings(id) ON DELETE CASCADE,
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  content             JSONB NOT NULL,
  -- Status enforces human-review gate before export (FR-8)
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','human_reviewed','approved')),
  reviewed_by         TEXT,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE evidence_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_drafts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON evidence_drafts
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON evidence_drafts TO sentinel8_app;

-- ── findings additions ────────────────────────────────────────
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fix_pr_url     TEXT;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS fix_pr_number  INTEGER;
ALTER TABLE findings ADD COLUMN IF NOT EXISTS triage_result_id UUID
  REFERENCES triage_results(id) ON DELETE SET NULL;

-- GIN index for full-text RAG retrieval on triage_embeddings
CREATE INDEX IF NOT EXISTS triage_embeddings_fts_idx
  ON triage_embeddings USING gin(to_tsvector('english', content));
