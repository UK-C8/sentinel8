-- ============================================================
-- RLS isolation smoke test — run as neondb_owner (superuser)
-- Test switches to sentinel8_app role (non-superuser) so RLS fires.
-- Expected: NOTICE "RLS test PASSED" with no errors.
-- ============================================================

DO $$
DECLARE
  tenant_a UUID;
  tenant_b UUID;
  finding_a UUID;
  count_cross INT;
BEGIN
  -- Seed two tenants (superuser, bypasses RLS intentionally for setup)
  INSERT INTO tenants (name) VALUES ('Tenant Alpha') RETURNING id INTO tenant_a;
  INSERT INTO tenants (name) VALUES ('Tenant Beta')  RETURNING id INTO tenant_b;

  -- Seed findings as superuser (bypasses RLS for setup)
  INSERT INTO findings (tenant_id, type, severity, asset, fingerprint, source_scanner)
  VALUES (tenant_a, 'cve', 'high', 'repo/api', 'rls-test-fp-alpha', 'trivy')
  RETURNING id INTO finding_a;

  INSERT INTO findings (tenant_id, type, severity, asset, fingerprint, source_scanner)
  VALUES (tenant_b, 'secret', 'critical', 'repo/web', 'rls-test-fp-beta', 'gitleaks');

  -- Switch to non-superuser app role so RLS is enforced
  SET LOCAL ROLE sentinel8_app;

  -- ── Assert: as tenant B, cannot see tenant A's finding ───────
  EXECUTE format('SET LOCAL app.current_tenant_id = %L', tenant_b);

  SELECT COUNT(*) INTO count_cross
  FROM findings
  WHERE id = finding_a;

  IF count_cross != 0 THEN
    RAISE EXCEPTION 'RLS FAIL: tenant B read tenant A finding (count=%), tenant_a=%, tenant_b=%',
      count_cross, tenant_a, tenant_b;
  END IF;

  -- ── Assert: as tenant A, can see own finding ─────────────────
  EXECUTE format('SET LOCAL app.current_tenant_id = %L', tenant_a);

  SELECT COUNT(*) INTO count_cross
  FROM findings
  WHERE id = finding_a;

  IF count_cross != 1 THEN
    RAISE EXCEPTION 'RLS FAIL: tenant A cannot read own finding (count=%), tenant_a=%',
      count_cross, tenant_a;
  END IF;

  RAISE NOTICE 'RLS test PASSED: cross-tenant isolation confirmed (tenant_a=%, tenant_b=%)',
    tenant_a, tenant_b;

  -- Rollback all seed data
  RAISE EXCEPTION 'rollback_seed';

EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM = 'rollback_seed' THEN
      NULL; -- expected, test passed
    ELSE
      RAISE;
    END IF;
END;
$$;
