-- ============================================================
-- Phase 4: free "scan a repo" lead magnet (BR-6, FR-11)
-- Public, unauthenticated. Keyed by unguessable share_token.
-- No RLS — no tenant owns these rows until conversion.
-- ============================================================

CREATE TABLE IF NOT EXISTS free_scans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  share_token   TEXT NOT NULL UNIQUE,          -- unguessable, in the shareable URL
  repo_url      TEXT NOT NULL,                 -- normalized https://host/owner/repo.git
  repo_display  TEXT NOT NULL,                 -- owner/repo for UI
  ip_hash       TEXT NOT NULL,                 -- sha256(ip + salt) for rate limiting; not raw IP (privacy)
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed')),
  -- Summary counts (the shareable, no-signup surface)
  crit_count    INTEGER NOT NULL DEFAULT 0,
  high_count    INTEGER NOT NULL DEFAULT 0,
  med_count     INTEGER NOT NULL DEFAULT 0,
  low_count     INTEGER NOT NULL DEFAULT 0,
  -- Gated detail: sanitized top findings shown teaser-only; full detail requires tenant
  teaser        JSONB NOT NULL DEFAULT '[]',
  error         TEXT,
  converted_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ
);

-- Rate-limit lookup: recent scans per IP
CREATE INDEX IF NOT EXISTS free_scans_ip_created_idx ON free_scans (ip_hash, created_at DESC);
-- Worker poll: pending oldest first
CREATE INDEX IF NOT EXISTS free_scans_status_idx ON free_scans (status, created_at) WHERE status = 'pending';

-- Worker runs as neondb_owner (same as scan worker), so no app-role grant needed here.
-- Next.js API uses the owner connection for free-scan writes (public path, no tenant context).
