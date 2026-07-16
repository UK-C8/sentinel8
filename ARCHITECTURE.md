# Sentinel8 — Connector Security Model

*FR-1, BR-7 reference. Do not auto-merge changes to this file without a security review.*

---

## Principle

Every connector is **read-only, least-privilege, per-tenant**. Sentinel8 never holds long-lived cloud admin credentials and never writes to a connected environment.

---

## AWS

| Item | Design |
|------|--------|
| Credential model | Tenant creates a cross-account IAM role with a Sentinel8 trust policy. Sentinel8 assumes the role via `sts:AssumeRole` for the duration of each scan job, receiving short-lived session credentials (max 1 hour). |
| Permissions | Read-only managed policies only: `SecurityAudit`, `AWSConfigReadOnlyAccess`. No `iam:PassRole`, no `sts:AssumeRoleWithWebIdentity` on arbitrary principals. |
| Credential storage | Only the role ARN is stored in `connectors.credential_ref`. STS session tokens are never written to the database. |
| Scope | ARN prefix stored in `connectors.scope` limits Prowler to specific accounts/regions. |

## GCP / Azure

Same pattern: Sentinel8 holds a service-account key reference or managed-identity client-id; the actual key material lives in the secret store (not in Postgres). Short-lived tokens are fetched at scan time.

---

## GitHub App

| Item | Design |
|------|--------|
| Install model | Tenant installs the Sentinel8 GitHub App on their org. Sentinel8 stores the installation ID in `connectors.credential_ref`. |
| Scopes | `contents:read`, `metadata:read`, `security_events:read`. No write scopes. |
| Token lifetime | GitHub App installation tokens expire after 1 hour; fetched on demand per scan job. |

## GitLab

OAuth App with `read_repository` + `read_user` scopes. Refresh tokens stored as secret store references.

---

## Secret store

`connectors.credential_ref` always points to a secret store key (e.g. `sentinel8/tenants/{tenant_id}/connectors/{connector_id}`). The actual credential is never written to the database or logged. Secret store: AWS Secrets Manager (prod) / environment variable (dev).

---

## Per-tenant isolation

Each connector row is owned by a single tenant enforced by Postgres RLS (`003_rls.sql`). A scanner worker fetches connector credentials only after verifying `tenant_id` matches the job's `tenant_id`. Cross-tenant credential access is structurally impossible through the queue: `scan_jobs` RLS prevents a worker from dequeuing another tenant's job.

---

## Grant audit log

Every credential-access event (role assumption, token fetch, scan start/end) is written as a `finding_event` row with `actor = 'system'` and `event_type` capturing the action. This gives a full audit trail of when Sentinel8 accessed which tenant's environment, queryable per tenant. Operators can see the full log in the admin panel (Phase 3).

---

## Revocation

Setting `connectors.revoked_at` to a non-null timestamp immediately prevents new scan jobs from using that connector. Workers check `revoked_at IS NULL` before fetching credentials. Tenant can also revoke directly in GitHub/AWS/GCP/Azure — Sentinel8 will fail gracefully on the next attempt and mark the connector inactive.
