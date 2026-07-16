import Link from "next/link";
import Reveal from "./Reveal";

const C = {
  bg: "#0F172A", surface: "#1E293B", surface2: "#172136", border: "#334155",
  text: "#F1F5F9", sub: "#94A3B8", muted: "#64748B", accent: "#38BDF8",
  red: "#F87171", orange: "#FB923C", amber: "#FBBF24", green: "#34D399",
} as const;

// Brand gradients (from Figma). Buttons use a navy-weighted variant so light
// text stays legible across the whole fill — the two hex stops are unchanged,
// just given uneven real estate. Text-on-dark-background uses the full sweep.
const GRADIENT_TEXT = "linear-gradient(90deg, #1A0A96 0%, #34E3FF 100%)";
const GRADIENT_BUTTON = "linear-gradient(120deg, #1A0A96 0%, #1A0A96 32%, #34E3FF 100%)";
const GRADIENT_HIGHLIGHT = "linear-gradient(90deg, #FD37C2 0%, #FFD96C 100%)";

const gradientText = (gradient: string): React.CSSProperties => ({
  backgroundImage: gradient,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
});

export const metadata = {
  title: "Sentinel8 — AI security, compliance & uptime for FinTech teams",
  description:
    "Continuous scanning, AI-cited triage, draft-only fix PRs, and SOC 2 / GDPR / DPDP control mapping. Free repo scan, no signup.",
};

const FEATURES = [
  {
    title: "Continuous scanning",
    body: "Trivy, Semgrep, and Gitleaks run on a schedule against every connected repo and cloud account. Every result rolls into one deduplicated findings list — no triaging four separate scanner outputs by hand.",
  },
  {
    title: "AI triage, always cited",
    body: "Every explanation names the CVE or rule it's based on — no finding is ever explained without a source. Priority and confidence are computed, not guessed, and every AI output carries a visible human-review marker until approved.",
  },
  {
    title: "Fix PRs, never auto-merged",
    body: "Sentinel8 drafts a pull request for the fix and links it back to the finding. It never merges on its own — draft-only is structural, not a setting, and a human approves every change.",
  },
  {
    title: "SOC 2 / GDPR / DPDP mapping",
    body: "Findings map to the controls they violate automatically. Evidence drafts are reviewable before they ever leave the platform, and audit-pack export produces a timestamped, control-traceable PDF + JSON.",
  },
  {
    title: "Public status, honestly",
    body: "Uptime and scan-pipeline health are pinged straight to Postgres and rendered on a public status page — the same page anyone can check, including you.",
  },
  {
    title: "Free scan, no signup",
    body: "Point it at any public repo and get a full findings report — every secret, CVE, and misconfiguration — plus a downloadable PDF. No account required.",
  },
];

const FRAMEWORKS = ["SOC 2", "GDPR", "DPDP"];

function SeverityMock() {
  const rows = [
    { sev: "critical", label: "CRIT", color: C.red, title: "Secret detected: aws-access-token in config/prod.env", asset: "app/config/prod.env" },
    { sev: "high", label: "HIGH", color: C.orange, title: "CVE-2024-21538 in lodash@4.17.20", asset: "package-lock.json" },
    { sev: "medium", label: "MED", color: C.amber, title: "SQL string built from request input", asset: "src/routes/orders.ts" },
    { sev: "low", label: "LOW", color: C.green, title: "Missing HTTP security headers", asset: "server.ts" },
  ];
  return (
    <div style={{ background: C.surface, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden", boxShadow: "0 24px 60px -20px rgba(0,0,0,0.5)" }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.amber }} />
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
        <span style={{ marginLeft: 8, fontSize: 12, color: C.muted, fontFamily: "var(--font-mono, monospace)" }}>
          sentinel8.dev/scan/report
        </span>
      </div>
      <div style={{ padding: "18px 18px 8px" }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${C.border}` }}>
            <span style={{ width: 4, alignSelf: "stretch", background: r.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: r.color, minWidth: 40 }}>{r.label}</span>
            <span style={{ fontSize: 13, color: C.text, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div style={{ background: C.bg, color: C.text, fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      {/* Nav */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 20, background: "#0F172ACC", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 12,
        padding: "0 24px", height: 60,
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id="s8-grad-nav" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1A0A96" />
              <stop offset="100%" stopColor="#34E3FF" />
            </linearGradient>
          </defs>
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#s8-grad-nav)" stroke="url(#s8-grad-nav)" strokeWidth="1.5" />
          <path d="M9 12l2 2 4-4" stroke="#0F172A" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontWeight: 700, fontSize: 17 }}>Sentinel8</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 24, fontSize: 14 }}>
          <a href="#features" style={{ color: C.sub, textDecoration: "none" }}>Features</a>
          <a href="#compliance" style={{ color: C.sub, textDecoration: "none" }}>Compliance</a>
          <Link href="/status" style={{ color: C.sub, textDecoration: "none" }}>Status</Link>
          <Link href="/scan" style={{
            padding: "8px 18px", fontSize: 13, fontWeight: 700, borderRadius: 7,
            backgroundImage: GRADIENT_BUTTON, color: C.text, textDecoration: "none",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}>
            Scan free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ maxWidth: 1180, margin: "0 auto", padding: "84px 24px 60px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 56, alignItems: "center" }}>
        <Reveal>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px", borderRadius: 20,
            background: "#12233A", border: "1px solid #34E3FF40", fontSize: 12.5, fontWeight: 700, marginBottom: 22,
          }}>
            <span style={gradientText(GRADIENT_TEXT)}>Built for FinTech &amp; SMB security teams</span>
          </div>
          <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.08, margin: 0 }}>
            Know what&apos;s wrong in your code and cloud —{" "}
            <span style={gradientText(GRADIENT_HIGHLIGHT)}>before an auditor does.</span>
          </h1>
          <p style={{ fontSize: 17, color: C.sub, lineHeight: 1.6, margin: "22px 0 32px", maxWidth: 520 }}>
            Sentinel8 connects read-only to your repos and cloud accounts, runs real scanners on a schedule,
            and turns the results into one deduplicated list — each finding explained by AI with a cited
            source, mapped to SOC 2 / GDPR / DPDP controls, and proposed as a draft fix. A human approves
            everything that ships.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/scan" style={{
              padding: "13px 26px", fontSize: 15, fontWeight: 700, borderRadius: 8,
              backgroundImage: GRADIENT_BUTTON, color: C.text, textDecoration: "none",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}>
              Scan a public repo — free
            </Link>
            <Link href="/onboarding" style={{
              padding: "13px 26px", fontSize: 15, fontWeight: 700, borderRadius: 8,
              background: "transparent", color: C.text, border: `1px solid ${C.border}`, textDecoration: "none",
            }}>
              See how onboarding works
            </Link>
          </div>
          <p style={{ fontSize: 12.5, color: C.muted, marginTop: 16 }}>
            No signup for the free scan · Read-only connectors only · Fix PRs are always draft-only
          </p>
        </Reveal>

        <Reveal delay={150}>
          <SeverityMock />
        </Reveal>
      </section>

      {/* Trust strip */}
      <section style={{ borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, background: C.surface2 }}>
        <Reveal>
          <div style={{
            maxWidth: 1180, margin: "0 auto", padding: "22px 24px", display: "flex", gap: 40,
            flexWrap: "wrap", justifyContent: "space-between", fontSize: 13, color: C.sub,
          }}>
            <span><strong style={{ color: C.text }}>Trivy · Semgrep · Gitleaks</strong> — real open-source scanners, not a black box</span>
            <span><strong style={{ color: C.text }}>Read-only, least-privilege</strong> connectors — GitHub/GitLab, AWS/GCP/Azure</span>
            <span><strong style={{ color: C.text }}>Draft-only fix PRs</strong> — nothing merges without a human</span>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section id="features" style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px" }}>
        <Reveal>
          <div style={{ maxWidth: 560, marginBottom: 48 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10, ...gradientText(GRADIENT_TEXT), display: "inline-block" }}>
              WHAT IT DOES
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
              One pipeline from raw scanner output to audit-ready evidence
            </h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 3) * 90}>
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "24px 22px", height: "100%",
              }}>
                <h3 style={{ fontSize: 16.5, fontWeight: 700, margin: "0 0 10px" }}>{f.title}</h3>
                <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: C.surface2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px" }}>
          <Reveal>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10, ...gradientText(GRADIENT_TEXT), display: "inline-block" }}>
              HOW IT WORKS
            </div>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 40px" }}>
              From zero to a populated dashboard in under 10 minutes
            </h2>
          </Reveal>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
            {[
              { n: "01", t: "Connect read-only", d: "Install the GitHub App or add a read-only cloud role. No write access, ever." },
              { n: "02", t: "First scan runs", d: "Trivy, Semgrep, and Gitleaks run automatically the moment a connector is live." },
              { n: "03", t: "AI triages & maps controls", d: "Each finding gets a cited explanation and a SOC 2 / GDPR / DPDP mapping." },
              { n: "04", t: "You approve the fix", d: "Review the draft PR and evidence. Nothing merges or exports without you." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div style={{ fontSize: 13, fontWeight: 800, color: C.muted, fontFamily: "var(--font-mono, monospace)", marginBottom: 10 }}>{s.n}</div>
                <h3 style={{ fontSize: 15.5, fontWeight: 700, margin: "0 0 8px" }}>{s.t}</h3>
                <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.55, margin: 0 }}>{s.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance */}
      <section id="compliance" style={{ maxWidth: 1180, margin: "0 auto", padding: "80px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
          <Reveal>
            <div style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 10, ...gradientText(GRADIENT_TEXT), display: "inline-block" }}>
              COMPLIANCE
            </div>
            <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 18px" }}>
              Evidence you can hand to an auditor — not just a checklist
            </h2>
            <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.65, marginBottom: 20 }}>
              Findings map to the SOC 2, GDPR, and DPDP controls they touch automatically. Every evidence
              draft carries an &quot;AI-generated, human-reviewed&quot; marker until someone signs off, and
              nothing leaves the platform in an audit-pack export without that approval. Sentinel8 produces
              evidence — it doesn&apos;t issue attestations.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {FRAMEWORKS.map((fw) => (
                <span key={fw} style={{
                  padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 700,
                  background: "#12233A", border: "1px solid #34E3FF40",
                }}>
                  <span style={gradientText(GRADIENT_TEXT)}>{fw}</span>
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={150}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", marginBottom: 16 }}>
                FRAMEWORK COVERAGE
              </div>
              {[
                { fw: "SOC 2", pct: 78 },
                { fw: "GDPR", pct: 64 },
                { fw: "DPDP", pct: 41 },
              ].map((row) => (
                <div key={row.fw} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{row.fw}</span>
                    <span style={{ color: row.pct >= 70 ? C.green : C.amber, fontWeight: 700 }}>{row.pct}%</span>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${row.pct}%`, height: "100%", background: row.pct >= 70 ? C.green : C.amber, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 11.5, color: C.muted, marginTop: 14, marginBottom: 0 }}>
                Illustrative — your coverage is computed from your own findings.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ borderTop: `1px solid ${C.border}` }}>
        <Reveal
          style={{ maxWidth: 780, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}
        >
          <h2 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
            Find out what&apos;s in your repo right now
          </h2>
          <p style={{ fontSize: 15, color: C.sub, marginBottom: 28 }}>
            Free, no signup, rate-limited to keep it fair. Full findings, downloadable PDF.
          </p>
          <Link href="/scan" style={{
            display: "inline-block", padding: "14px 32px", fontSize: 15.5, fontWeight: 700, borderRadius: 8,
            backgroundImage: GRADIENT_BUTTON, color: C.text, textDecoration: "none",
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}>
            Scan a public repo →
          </Link>
        </Reveal>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: `1px solid ${C.border}`, background: C.surface2 }}>
        <div style={{
          maxWidth: 1180, margin: "0 auto", padding: "28px 24px", display: "flex",
          justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.muted }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <defs>
                <linearGradient id="s8-grad-footer" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#1A0A96" />
                  <stop offset="100%" stopColor="#34E3FF" />
                </linearGradient>
              </defs>
              <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="url(#s8-grad-footer)" stroke="url(#s8-grad-footer)" strokeWidth="1.5" />
            </svg>
            Sentinel8 — a Centr8 product
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
            <Link href="/scan" style={{ color: C.sub, textDecoration: "none" }}>Free scan</Link>
            <Link href="/status" style={{ color: C.sub, textDecoration: "none" }}>Status</Link>
            <Link href="/onboarding" style={{ color: C.sub, textDecoration: "none" }}>Onboarding</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
