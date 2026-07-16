# CLAUDE.md — Sentinel8

Centr8's AI security, compliance & uptime command center. Internal dogfood first, then sold as a managed retainer to FinTech/SMB clients.

---

## 1. What this product does (plain language)

Sentinel8 connects (read-only) to a client's GitHub/GitLab repos and AWS/GCP/Azure accounts, runs open-source security scanners on a schedule, and rolls every result into one deduplicated findings list. A Claude-powered agent explains each finding in plain English, maps it to SOC 2/GDPR/DPDP compliance controls, and drafts a fix as a pull request — a human always approves before anything merges. Clients get a posture dashboard and one-click audit-evidence export. A public status page proves Sentinel8 meets its own uptime promises. A free "scan a repo" tool with no signup is the lead magnet into the paid product.

---

## 2. Locked architecture

Centr8's standard free-tier stack applies everywhere it's viable. The PRD's original stack (NestJS, Temporal, Kubernetes, Prometheus/Grafana/Loki) is replaced per the deviations below. This table is the single source of truth — do not reintroduce the original PRD stack without a phase-gate discussion.

| Layer | Locked choice | Deviation from PRD | Rationale |
|---|---|---|---|
| Frontend (portal + status page + free scan) | Next.js (App Router) + Tailwind, on Vercel | None | Matches PRD |
| API / orchestration | Next.js API routes | Was NestJS | Standard Centr8 stack; one framework for frontend + API |
| Scan scheduling & orchestration | Postgres-backed job queue (`SELECT ... FOR UPDATE SKIP LOCKED`) + Vercel Cron trigger | Was Temporal | No free-tier durable workflow engine available; same pattern as RAG Readiness Scanner |
| Scanner execution | Python scanner runners (Trivy, Semgrep, Gitleaks, Prowler) deployed as Railway worker services, pulled jobs from the Postgres queue | Was Kubernetes | Railway runs Docker workers without a K8s control plane |
| AI triage + fix-PR drafting | Anthropic Claude API + pgvector RAG | None (this is the product's core differentiator) | **Paid, usage-metered — flagged below** |
| Vector store | pgvector extension on Neon Postgres | None | Already free |
| Primary database | Neon Postgres, with row-level security for tenant isolation | None | Standard Centr8 stack |
| Auth | Supabase Auth (RLS-aware) | Added | Multi-tenant isolation requirement (FR-9) needs real RLS-integrated auth |
| Observability / status page | Custom-built: uptime + scan-pipeline health pings written to Postgres, rendered on a public Next.js status page | Was Prometheus + Grafana + Loki | No paid observability stack; avoids Grafana Cloud free-tier limits and ops overhead |
| Product analytics | PostHog (free tier) | None | Standard Centr8 stack |
| Notifications (Phase 4, Could-priority) | Resend (email) + Slack incoming webhook | Was unscoped in PRD | Matches Centr8 email standard; Slack webhooks are free |
| Cloud connectors | AWS/GCP/Azure official SDKs, read-only IAM roles; GitHub/GitLab Apps | None | Least-privilege requirement (BR-7) unchanged |
| PDF export (audit packs) | react-pdf (client-side), consistent with ExportInvoice Pro pattern | None | Reusable cross-project pattern |

### Flagged deviation requiring sign-off

**Claude API cost for the triage/RAG agent is a real, ongoing spend — not swappable for the free Gemini tier.** The PRD's own NFR sets a soft budget of < $40/environment/month with prompt/embedding caching (NFR — Observability & Cost). Treat this the same way as the Recur8 Phase 3 infrastructure gate: build it as designed, but flag actual per-tenant token cost to the founder/managing partner before GA and before onboarding the first paid external client. If cost run-away appears during internal dogfooding (Phase 2), pause and revisit caching/batching strategy before continuing.

---

## 3. Multi-tenancy pattern

Sentinel8 is multi-tenant from day one (unlike some Centr8 tools that start single-tenant). This is non-negotiable per BR-4/FR-9 and Risk R-6 (cross-tenant data leak = catastrophic for a security vendor). Every table with tenant-scoped data uses Postgres row-level security, enforced server-side on every query — never client-side filtering alone. pgvector embeddings are namespaced per tenant. Isolation tests belong in CI from Phase 1 onward, not bolted on later.

Admin/internal operator views (Devang's compliance review queue, Aakash's scan health dashboard) follow the separate-repo pattern already established with rag-admin and exportinvoice-admin — build `sentinel8-admin` as its own repo once Phase 3 begins, rather than a subfolder of the client-facing portal.

---

## 4. AI output safety pattern

Every AI-generated artifact (triage explanation, fix PR, evidence draft) must carry a visible "AI-generated, human-reviewed" marker until a human approves it — this is the same provisional-results banner pattern established in LucidCarat and carried into LoomOS. Specifically:

- No triage explanation may be shown without at least one cited source rule/CVE ID (FR-5).
- No fix PR may ever auto-merge — draft-only, always (FR-6, explicit non-goal in PRD).
- No finding may flip to "resolved" without a corresponding scan-verified state change (Acceptance Criteria).
- No evidence artifact may leave the platform (export) without human review and approval (FR-8).

---

## 5. Requirement ID reference

Carried forward from BRD/PRD for traceability. Use these IDs in commits, PR descriptions, and phase completion checks.

**Business requirements (BRD):** BR-1 (continuous scan + normalized findings), BR-2 (control mapping + evidence auto-draft), BR-3 (AI triage + fix PR), BR-4 (multi-tenant portal), BR-5 (public status/SLA), BR-6 (free scan magnet), BR-7 (least-privilege connectors).

**Functional requirements (PRD):** FR-1 (connector onboarding), FR-2 (scan orchestration), FR-3 (findings normalization/dedup), FR-4 (finding lifecycle states), FR-5 (AI triage agent), FR-6 (fix-PR generation), FR-7 (control-mapping engine), FR-8 (evidence auto-draft + audit-pack export), FR-9 (multi-tenant posture portal), FR-10 (status/SLA layer — Should), FR-11 (free scan magnet — Should), FR-12 (notifications/ticketing — Could).

**Non-functional requirements (PRD section 7):** Performance (<2s p95 dashboard, <60min daily scan for ≤50 repos + 1 cloud account), Scalability (100+ tenants, 5,000+ assets), Security (read-only least-privilege, encryption at rest/in transit, SSO/MFA for operators), Privacy & Compliance (GDPR + DPDP, data residency, right to erasure), Accessibility (WCAG 2.1 AA), Availability (99.9% monthly control-plane), Compatibility (GitHub/GitLab + AWS/GCP/Azure, current major browsers, PDF/JSON export), Observability & Cost (<$40/environment/month LLM spend).

**Risks (BRD section 10 / PRD section 13):** R-1 (LLM hallucination in triage/PR), R-2 (over-privileged connector), R-3 (false-positive rate erodes trust), R-4 (auditors reject auto-drafted evidence), R-5 (crowded market — Snyk/Wiz/Vanta/Drata), R-6 (multi-tenant data isolation flaw).

---

## 6. Acceptance criteria (from PRD section 11)

- New tenant connects GitHub org + AWS account read-only, sees a populated posture dashboard within 10 minutes of initial scan.
- Same underlying issue detected by multiple scanners appears as one deduplicated finding with correct severity/asset attribution.
- Every AI triage explanation cites at least one source rule/CVE ID and mapped control(s); no finding marked resolved without a scan-verified state change.
- Generated fix PR is always draft-only, links back to its finding, never auto-merges.
- ≥ 70% of in-scope SOC 2/GDPR/DPDP controls show auto-mapped status with a draft evidence artifact, reviewable before export.
- Audit-pack export produces a timestamped, control-ID-traceable document (PDF + JSON).
- Cross-tenant isolation tests pass — no query path returns another tenant's findings or vectors.
- Public status page reflects real control-plane availability and scan-pipeline health, with incident history.
- Free repo scan returns a shareable summary for a public repo URL without signup, with rate limiting in place.

---

## 7. Out of scope (v1)

- Active exploitation / penetration testing / red-teaming — read-only posture only.
- Auto-merging or auto-deploying fix PRs — human approval always required.
- Issuing SOC 2/ISO attestations — Sentinel8 produces evidence, not certification.
- DAST / dynamic web scanning and runtime EDR agents.
- On-prem / self-hosted customer deployments — cloud-hosted multi-tenant only.
- Connectors beyond GitHub/GitLab and AWS/GCP/Azure (e.g., Bitbucket, Oracle Cloud, on-prem VMware).
- General-purpose SIEM/log-analytics product for client application logs.

---

## 8. Open questions (unresolved — do not silently assume)

1. What exact data residency regions must be offered at GA for UK/UAE/EU/India FinTech clients? Does any client require single-tenant isolation? — Owner: Head of Security & Compliance.
2. Will auditor partners accept Sentinel8 evidence packs as-is, or do specific frameworks need bespoke evidence formats? — Owner: Head of Security & Compliance / vCISO partner.
3. Pricing model granularity — per-environment vs per-asset vs tiered? — Owner: Founder / Managing Partner.

---

## 9. Reusable cross-project patterns applied here

- Postgres-backed job queue (SELECT FOR UPDATE SKIP LOCKED) — from RAG Readiness Scanner.
- Separate-repo admin panel pattern — from ExportInvoice Pro.
- react-pdf client-side PDF generation — from ExportInvoice Pro.
- Provisional/human-review banner on unverified AI output — from LucidCarat, LoomOS.
- SQLAlchemy/Alembic: let `sa.Enum` handle type creation inside `create_table` — do not manually `CREATE TYPE`.
- Neon pooler inconsistency for DDL — use direct non-pooled connection string for migrations.

---

## 10. Phase map (see PHASE_PROMPTS.md for paste-ready prompts)

| Phase | Outcome | Maps to BRD phase |
|---|---|---|
| Phase 0 | Data model, tenant isolation design, control-mapping schema, connector security design | BRD Phase 0 |
| Phase 1 | GitHub + AWS connectors, scanner queue + Trivy/Semgrep/Gitleaks/Prowler running, findings store, internal dashboard | BRD Phase 1 (internal MVP) |
| Phase 2 | Control-mapping engine, Claude + pgvector triage agent, fix-PR generation, GCP/Azure/GitLab connectors, full internal dogfood | BRD Phase 2 |
| Phase 3 | Multi-tenant posture portal (with RLS), audit-pack export, public status/SLA page, sentinel8-admin repo, hardening | BRD Phase 3 |
| Phase 4 | Free "scan a repo" magnet, notifications (Could), GTM instrumentation, first paid external clients | BRD Phase 4 |
