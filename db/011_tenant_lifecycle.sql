-- Phase 4: tenant lifecycle for the funnel (free_scan → tenant_created → retainer_activated).
-- 'plan' is a lifecycle state, NOT a price. Pricing/packaging is open question #3 (founder-owned).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial'
  CHECK (plan IN ('trial', 'retainer'));
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;
