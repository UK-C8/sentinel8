# PHASE_PROMPTS.md — Sentinel8

Paste-ready prompts for Claude Code, in order. Do not skip a phase before its acceptance criteria pass. Each prompt assumes CLAUDE.md is present in the repo root and should be read first.

---

## Phase 0 — Discovery & architecture

```
Read CLAUDE.md in full before doing anything else.

Set up the Sentinel8 repo skeleton on our standard free-tier stack:
Next.js (App Router) + Tailwind, Next.js API routes, Neon Postgres with
pgvector extension enabled, Supabase Auth for RLS-aware authentication.

Do the following:

1. Initialize the Next.js project with TypeScript, Tailwind, and the
   standard Centr8 folder structure (app/, lib/, db/).
2. Design and write the initial Postgres schema (as SQLAlchemy-free raw
   SQL migration, or Drizzle/Prisma if that's our current convention —
   check for an existing pattern in other Centr8 repos first) covering:
   - tenants (id, name, region, created_at)
   - connectors (id, tenant_id, provider [github|gitlab|aws|gcp|azure],
     scope, read_only bool, credential_ref, created_at, revoked_at)
   - findings (id, tenant_id, type [cve|secret|misconfig|iam_drift|
     public_bucket], severity, asset, fingerprint for dedup, status
     [open|triaged|fix_proposed|fixed|accepted_risk|suppressed],
     first_seen, last_seen, source_scanner)
   - finding_events (id, finding_id, actor, event_type, reason, created_at)
   - control_mappings (id, tenant_id, framework [soc2|gdpr|dpdp],
     control_id, finding_id nullable, status [met|gap|na], evidence_ref)
   - scan_jobs (id, tenant_id, connector_id, status, scheduled_for,
     started_at, completed_at, locked_by, locked_at) — this is our
     Postgres-backed job queue table, replacing Temporal per CLAUDE.md.
3. Add row-level security policies on every tenant-scoped table now,
   not later — tenant_id must be enforced server-side on every query.
   Write a basic RLS test that proves tenant A cannot read tenant B's
   findings.
4. Design the pgvector table for the AI triage RAG corpus, namespaced
   per tenant (tenant_id column, not a separate schema).
5. Write a short ARCHITECTURE.md documenting the connector security
   model: read-only IAM role assumption for AWS/GCP/Azure, GitHub/GitLab
   App install scopes, short-lived credentials, per-tenant secret
   isolation, and the grant audit log design (FR-1, BR-7).
6. Use the direct (non-pooled) Neon connection string for all migrations,
   per our established pattern.

Stop after this and show me the schema and RLS test results before
proceeding — do not start building the scanner pipeline yet.
```

**Acceptance check before moving on:** schema exists, RLS test proves cross-tenant isolation at the database level, connector security model is documented and makes sense for least-privilege access.

---

## Phase 1 — Scanning core + internal MVP

```
Read CLAUDE.md and ARCHITECTURE.md before starting.

Build the scan orchestration and findings pipeline for Sentinel8,
scoped to GitHub + AWS only for this phase (BR-1, FR-1, FR-2, FR-3).

1. Build the GitHub connector: App installation flow (read + PR-create
   scope), storing the installation as a row in `connectors`, with a
   grant audit log entry on creation.
2. Build the AWS connector: guided read-only IAM role assumption
   (generate the CloudFormation/Terraform snippet the user runs),
   short-lived credential handling, stored per-tenant.
3. Build the Postgres-backed job queue: a worker process that polls
   `scan_jobs` using `SELECT ... FOR UPDATE SKIP LOCKED`, with retry
   logic, timeouts, and concurrency limits. Trigger daily scheduling via
   Vercel Cron hitting an API route that enqueues jobs.
4. Set up Python scanner runners for Trivy, Semgrep, and Gitleaks
   (Prowler comes in Phase 2 with the cloud connectors) as Railway
   worker services that pull jobs from the queue and write raw results
   back.
5. Build the findings normalization layer: ingest raw scanner output
   into the unified `findings` schema, generate a stable fingerprint per
   issue so the same problem detected by multiple scanners becomes one
   deduplicated record (FR-3).
6. Implement the finding lifecycle state machine (open -> triaged ->
   fix-proposed -> fixed / accepted-risk / suppressed), writing an
   actor + timestamp + reason to `finding_events` on every transition.
7. Build a basic internal-only dashboard (no multi-tenant portal yet —
   that's Phase 3) showing scan status and the raw findings list for
   Centr8's own GitHub org + one AWS account.

Acceptance criteria for this phase: Centr8's own repos and one AWS
account are scanning daily, findings are deduplicated correctly across
scanners, and a new connection produces a populated findings list within
10 minutes of the initial scan. Do not proceed to Phase 2 until this
passes.
```

---

## Phase 2 — Compliance mapping + AI triage + full dogfood

```
Read CLAUDE.md before starting. Confirm Phase 1 acceptance criteria
passed before proceeding.

This phase adds the control-mapping engine, the Claude + pgvector triage
agent, fix-PR generation, and GCP/Azure/GitLab connectors (BR-2, BR-3,
FR-5, FR-6, FR-7, FR-8).

1. Add GCP, Azure, and GitLab connectors following the same
   least-privilege pattern as GitHub/AWS from Phase 1.
2. Add the Prowler scanner runner (cloud CSPM/IAM drift/public buckets)
   as a Railway worker.
3. Build the control-mapping engine: map finding types + configuration
   state to SOC 2 Trust Services Criteria, GDPR articles, and India DPDP
   articles, computing per-control status (met/gap/n-a). Make the
   mapping rules reviewable/editable, not hardcoded magic.
4. Build the AI triage agent using the Claude API + pgvector RAG:
   - Ground every response in the scanner detail + control text
     retrieved from the tenant's pgvector namespace.
   - Output: plain-English explanation, priority, confidence score, and
     at least one cited source rule/CVE ID. Never output a triage result
     without a citation — hard requirement (FR-5).
   - Cache embeddings; track token usage per tenant against the
     <$40/environment/month soft budget noted in CLAUDE.md, and log a
     budget alert when a tenant crosses 80% of that threshold.
5. Build fix-PR generation: the agent drafts a remediation PR
   (dependency bump, IaC fix, or secret-removal guidance) as draft-only
   against the connected repo. The PR body must link back to the
   originating finding and control. Never auto-merge — there is no
   code path that merges without a human clicking merge (FR-6).
6. Build evidence auto-drafting: generate per-control evidence artifacts
   (scan results, config snapshots, timestamps) tied to control_mappings,
   marked as requiring human review before they can be exported (FR-8,
   deferred export UI to Phase 3).
7. Onboard 100% of Centr8's own repos and all three cloud accounts to
   complete internal dogfooding.

Acceptance criteria: every AI triage explanation cites a source; no fix
PR ever auto-merges; at least 70% of in-scope controls show an
auto-mapped status with draft evidence; Centr8's full fleet is scanning
daily. Report actual Claude API token cost per tenant so far — this
needs to be flagged to the founder per CLAUDE.md before we go further.
```

---

## Phase 3 — Multi-tenant portal, status/SLA layer, hardening

```
Read CLAUDE.md before starting. Confirm Phase 2 acceptance criteria
passed, including the token-cost flag being reviewed.

This phase builds the client-facing product surface (BR-4, BR-5, FR-9,
FR-10) and prepares for external tenants.

1. Build the per-client posture portal: dashboard with posture score,
   trend chart, prioritized remediation queue, framework coverage view,
   and one-click audit-pack export (PDF via react-pdf + JSON). Every
   query must go through the RLS-enforced tenant context — no
   client-side-only filtering.
2. Write and run cross-tenant isolation tests as a CI gate: no query
   path may return another tenant's findings or vectors. This blocks
   merge if it fails.
3. Create the `sentinel8-admin` repo (separate repo, not a subfolder —
   matches the rag-admin / exportinvoice-admin pattern) for Devang's
   compliance review queue and Aakash's scan health dashboard. Internal
   operators approve evidence before it can be exported to a client.
4. Build the public status/SLA layer: a Next.js public status page
   backed by uptime + scan-pipeline health pings written to Postgres
   (our custom substitute for Prometheus/Grafana/Loki per CLAUDE.md).
   Include incident history and per-managed-environment SLA display.
5. Add notification hooks (Could-priority, FR-12) if time allows: Slack
   webhook + Resend email for new critical/high findings and SLA
   breaches, configurable per tenant.
6. Run an internal security hardening pass and pen-review checklist
   before marking this GA-ready — this is a security product; skipping
   this step is not an option.

Acceptance criteria: cross-tenant isolation tests pass in CI; audit-pack
export produces a timestamped, control-ID-traceable PDF + JSON; public
status page reflects real availability and scan-pipeline health with
incident history visible.
```

---

## Phase 4 — Free magnet, GTM, first paid clients

```
Read CLAUDE.md before starting. Confirm Phase 3 acceptance criteria
passed.

This phase builds the top-of-funnel lead magnet and onboarding path
(BR-6, FR-11).

1. Build the free "scan a repo" flow: accept a public repo URL, run
   Semgrep/Gitleaks/Trivy against it with no signup required, and return
   a shareable summary report with an upgrade CTA. Gate any deeper
   detail behind tenant creation. Add rate limiting and abuse protection
   (this is a public, unauthenticated endpoint hitting real scanners —
   treat it as an attack surface).
2. Instrument the funnel in PostHog: free_scan_completed ->
   tenant_created -> retainer_activated, plus all other analytics events
   listed in the PRD (connector_added, scan_started, scan_completed,
   finding_opened, finding_resolved, triage_generated, fix_pr_proposed,
   fix_pr_merged, control_mapped, audit_pack_exported, sla_breach).
3. Build the onboarding playbook flow for the first external paid
   clients: guided connector setup, expected timeline to first populated
   dashboard (<10 minutes per acceptance criteria).
4. Confirm pricing/retainer packaging with the founder before quoting
   the first external client — this is still an open question per
   CLAUDE.md section 8.

Acceptance criteria: a public repo URL produces a shareable free-scan
summary with no signup and proper rate limiting; the funnel is fully
instrumented in PostHog; at least one external paid environment is live.
```
