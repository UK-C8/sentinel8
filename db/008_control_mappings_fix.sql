ALTER TABLE control_mappings ADD COLUMN IF NOT EXISTS control_name TEXT;
ALTER TABLE control_mappings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS control_mappings_tenant_framework_control_idx
  ON control_mappings (tenant_id, framework, control_id);
