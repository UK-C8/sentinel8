"use client";

const C = {
  bg: "#0F172A", surface: "#1E293B", border: "#334155", muted: "#64748B",
  text: "#F1F5F9", sub: "#94A3B8", accent: "#38BDF8", green: "#34D399",
} as const;

const STEPS = [
  {
    n: 1,
    title: "Connect GitHub (read-only)",
    time: "~2 min",
    body: "Install the Sentinel8 GitHub App on the org or repos you want scanned. It requests read-only access — code contents and metadata only. No write scope, no PR-merge scope.",
    action: { label: "Install GitHub App", href: "/api/connectors/github/install" },
  },
  {
    n: 2,
    title: "Connect a cloud account (optional, read-only)",
    time: "~3 min",
    body: "Add an AWS account via a read-only IAM role (least-privilege, BR-7). GCP and Azure use the same pattern. Skip this to start with code scanning only.",
    action: { label: "Set up AWS role", href: "/api/connectors/aws" },
  },
  {
    n: 3,
    title: "First scan runs automatically",
    time: "~5 min",
    body: "The moment a connector is live, a scan is queued. Trivy, Semgrep, and Gitleaks run against your repos; results are normalized and deduplicated into a single findings list.",
    action: null,
  },
  {
    n: 4,
    title: "Your posture dashboard populates",
    time: "under 10 min total",
    body: "Open the portal to see your posture score, prioritized remediation queue, framework coverage, and — once triaged — AI explanations with cited CVEs and draft fix PRs.",
    action: { label: "Open posture portal", href: "/portal" },
  },
];

export default function OnboardingPage() {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#1E40AF" stroke={C.accent} strokeWidth="1.5"/>
          <path d="M9 12l2 2 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Sentinel8</span>
        <span style={{ marginLeft: 8, padding: "2px 8px", background: "#1E3A5F", color: C.accent, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>ONBOARDING</span>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>
          From zero to a populated dashboard in under 10 minutes
        </h1>
        <p style={{ fontSize: 16, color: C.sub, marginBottom: 36, lineHeight: 1.5 }}>
          Connect read-only, let the first scan run, and watch your security posture appear. You approve every fix — nothing merges on its own.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ display: "flex", gap: 18, paddingBottom: i === STEPS.length - 1 ? 0 : 28 }}>
              {/* Step rail */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: "#12233A", border: `2px solid ${C.accent}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: C.accent, fontSize: 15,
                }}>{s.n}</div>
                {i !== STEPS.length - 1 && (
                  <div style={{ width: 2, flex: 1, background: C.border, marginTop: 6 }} />
                )}
              </div>

              {/* Step body */}
              <div style={{ flex: 1, paddingBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>{s.title}</h2>
                  <span style={{ fontSize: 12, color: C.green, fontWeight: 600 }}>{s.time}</span>
                </div>
                <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.55, margin: "8px 0 0" }}>{s.body}</p>
                {s.action && (
                  <a href={s.action.href} style={{
                    display: "inline-block", marginTop: 12, padding: "8px 18px",
                    fontSize: 13, fontWeight: 600, borderRadius: 6,
                    background: "#12233A", color: C.accent, border: `1px solid ${C.accent}40`,
                    textDecoration: "none",
                  }}>{s.action.label} →</a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 36, padding: 18, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
          <strong style={{ color: C.text }}>What you get on day one:</strong> deduplicated findings across all scanners,
          AI triage citing at least one CVE/rule per explanation, draft-only fix PRs, and SOC 2 / GDPR / DPDP
          control mapping with reviewable evidence drafts. Human review is required before any evidence leaves the platform.
        </div>
      </div>
    </div>
  );
}
