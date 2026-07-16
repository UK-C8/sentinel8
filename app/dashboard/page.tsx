import pool from "@/lib/db";

async function getData() {
  const [jobs, findings, counts, cost] = await Promise.all([
    pool.query(`
      SELECT sj.id, sj.status, sj.scheduled_for, sj.started_at, sj.completed_at,
             c.provider, t.name AS tenant_name
      FROM scan_jobs sj
      JOIN connectors c ON c.id = sj.connector_id
      JOIN tenants t ON t.id = sj.tenant_id
      ORDER BY sj.scheduled_for DESC LIMIT 10
    `),
    pool.query(`
      SELECT f.id, f.title, f.type, f.severity, f.status, f.asset,
             split_part(f.asset,'/',1)||'/'||split_part(f.asset,'/',2) AS repo,
             f.source_scanner, f.rule_id, f.last_seen,
             f.fix_pr_url, f.fix_pr_number,
             tr.priority AS triage_priority,
             tr.explanation AS triage_explanation,
             tr.approved_at AS triage_approved_at
      FROM findings f
      JOIN tenants t ON t.id = f.tenant_id
      LEFT JOIN triage_results tr ON tr.finding_id = f.id
      ORDER BY
        CASE f.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
          WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
        f.last_seen DESC
      LIMIT 100
    `),
    pool.query(`SELECT severity, status, COUNT(*) AS cnt FROM findings GROUP BY severity, status`),
    pool.query(`SELECT COALESCE(SUM(cost_usd),0) AS month_spend FROM api_usage WHERE date_trunc('month',created_at)=date_trunc('month',now())`),
  ]);
  return { jobs: jobs.rows, findings: findings.rows, counts: counts.rows, monthSpend: Number(cost.rows[0]?.month_spend ?? 0) };
}

// ── design tokens (explicit hex, no CSS vars) ──────────────────────────
const C = {
  bg:           "#0F172A",
  surface:      "#1E293B",
  surfaceHi:    "#273549",
  border:       "#334155",
  borderSubtle: "#1E293B",
  text:         "#F1F5F9",
  textSec:      "#94A3B8",
  textMut:      "#475569",
  accent:       "#3B82F6",
  accentDim:    "#1E3A5F",
} as const;

const SEV = {
  critical:      { stripe: "#EF4444", text: "#EF4444", label: "Critical" },
  high:          { stripe: "#F97316", text: "#F97316", label: "High" },
  medium:        { stripe: "#EAB308", text: "#EAB308", label: "Medium" },
  low:           { stripe: "#22C55E", text: "#22C55E", label: "Low" },
  informational: { stripe: "#475569", text: "#64748B", label: "Info" },
} as const;

const STATUS = {
  open:          { bg: "#3F1515", color: "#FCA5A5", label: "Open" },
  triaged:       { bg: "#2D1F4E", color: "#C4B5FD", label: "Triaged" },
  fix_proposed:  { bg: "#1E3A5F", color: "#93C5FD", label: "Fix proposed" },
  fixed:         { bg: "#14392A", color: "#86EFAC", label: "Fixed" },
  accepted_risk: { bg: "#1E293B", color: "#94A3B8", label: "Accepted" },
  suppressed:    { bg: "#1E293B", color: "#64748B", label: "Suppressed" },
} as const;

const SCAN_STATUS = {
  completed: { bg: "#14392A", color: "#86EFAC" },
  running:   { bg: "#1E3A5F", color: "#93C5FD" },
  failed:    { bg: "#3F1515", color: "#FCA5A5" },
  pending:   { bg: "#1E293B", color: "#94A3B8" },
} as const;

function fmt(d: string | Date) { return new Date(d).toISOString().slice(0, 10); }
function dur(s: string | null, e: string | null) {
  if (!s) return "—";
  if (!e) return "running…";
  const sec = Math.round((+new Date(e) - +new Date(s)) / 1000);
  return sec < 60 ? `${sec}s` : `${Math.round(sec / 60)}m`;
}

// ── row heights for the stripe ─────────────────────────────────────────
const ROW_H = "52px";

export default async function DashboardPage() {
  const { jobs, findings, counts, monthSpend } = await getData();

  const sevOrder = ["critical","high","medium","low"] as const;
  const stats = sevOrder.map(s => ({
    s,
    total: counts.filter(r => r.severity===s).reduce((a,r)=>a+Number(r.cnt),0),
    open:  Number(counts.find(r => r.severity===s && r.status==="open")?.cnt ?? 0),
  }));

  const triaged = findings.filter(f => f.triage_priority).length;
  const overBudget = monthSpend > 32;

  // ── shared box style ──────────────────────────────────────────────────
  const box = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: "12px",
    overflow: "hidden" as const,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

      {/* ── sticky nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "#0F172Aee", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.border}`,
        height: 56, display: "flex", alignItems: "center",
        justifyContent: "space-between", padding: "0 28px",
      }}>
        {/* logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 1.5L2.5 4.5V9.5C2.5 13.5 5.8 17.2 10 18.5C14.2 17.2 17.5 13.5 17.5 9.5V4.5L10 1.5Z"
              fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1.4" strokeLinejoin="round"/>
            <path d="M7 10L9 12L13 8" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em", color: C.text }}>
            Sentinel<span style={{ color: C.accent }}>8</span>
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.textMut, letterSpacing: "0.1em", textTransform: "uppercase", marginLeft: 4 }}>
            Internal
          </span>
        </div>

        {/* right controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500,
            background: overBudget ? "#3F1515" : C.accentDim,
            border: `1px solid ${overBudget ? "#7F1D1D" : "#1E4080"}`,
            color: overBudget ? "#FCA5A5" : "#93C5FD",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontWeight: 700, color: overBudget ? "#FCA5A5" : C.text }}>
              ${monthSpend.toFixed(4)}
            </span>
            <span style={{ color: C.textSec }}>LLM / mo</span>
            {overBudget && <span>⚠</span>}
          </div>
          <a href="/api/connectors/github/install" style={{
            padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: C.accent, color: "#fff", textDecoration: "none",
          }}>+ Connect</a>
        </div>
      </nav>

      <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 28px 64px" }}>

        {/* ── page title ── */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>
            Security Posture
          </h1>
          <p style={{ marginTop: 5, fontSize: 13, color: C.textSec }}>
            Centr8 &nbsp;·&nbsp; {findings.length} findings &nbsp;·&nbsp;
            last scan {jobs[0] ? fmt(jobs[0].scheduled_for) : "—"}
          </p>
        </div>

        {/* ── severity tiles ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
          {stats.map(({ s, total, open }) => {
            const sv = SEV[s];
            return (
              <div key={s} style={{
                background: C.surface, borderRadius: 12,
                border: `1px solid ${C.border}`,
                borderTop: `3px solid ${sv.stripe}`,
                padding: "20px 22px 18px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: sv.text }}>
                  {sv.label}
                </div>
                <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.05, marginTop: 8, color: C.text, fontVariantNumeric: "tabular-nums" }}>
                  {total}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: C.textSec }}>
                  <span style={{ color: open > 0 ? sv.text : C.textMut, fontWeight: 700 }}>{open}</span> open
                </div>
              </div>
            );
          })}
        </div>

        {/* ── scans + triage row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>

          {/* recent scans */}
          <div style={box}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Recent Scans</span>
              <span style={{ fontSize: 11, color: C.textMut, fontFamily: "var(--font-mono),monospace" }}>{jobs.length} jobs</span>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Provider","Status","Scheduled","Duration"].map(h => (
                    <th key={h} style={{ padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.textMut, borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(j => {
                  const sc = (SCAN_STATUS as Record<string,{bg:string;color:string}>)[j.status] ?? SCAN_STATUS.pending;
                  return (
                    <tr key={j.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                      <td style={{ padding: "11px 16px", color: C.textSec }}>{j.provider}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ padding: "3px 9px", borderRadius: 5, fontSize: 12, fontWeight: 600, background: sc.bg, color: sc.color, display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.color, display: "inline-block" }} />
                          {j.status}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: C.textMut, fontFamily: "var(--font-mono),monospace" }}>
                        {new Date(j.scheduled_for).toISOString().replace("T"," ").slice(0,16)}
                      </td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: C.textSec, fontFamily: "var(--font-mono),monospace" }}>
                        {dur(j.started_at, j.completed_at)}
                      </td>
                    </tr>
                  );
                })}
                {jobs.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 28, textAlign: "center", color: C.textMut, fontSize: 13 }}>No scans yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* triage coverage */}
          <div style={box}>
            <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>AI Triage Coverage</span>
              <span style={{ fontSize: 11, color: C.textMut }}>{triaged} / {findings.length} triaged</span>
            </div>
            <div style={{ padding: 20 }}>
              {/* progress bar */}
              <div style={{ background: C.border, borderRadius: 4, height: 6, marginBottom: 20, overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: 4, background: C.accent,
                  width: findings.length > 0 ? `${(triaged/findings.length)*100}%` : "0%",
                }} />
              </div>

              {(["immediate","high","medium","low"] as const).map(p => {
                const c = findings.filter(f => f.triage_priority === p).length;
                if (!c) return null;
                const col = p==="immediate" ? "#EF4444" : p==="high" ? "#F97316" : p==="medium" ? "#EAB308" : "#22C55E";
                return (
                  <div key={p} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: col, display: "inline-block" }} />
                      <span style={{ fontSize: 13, textTransform: "capitalize", color: C.textSec }}>{p}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: "var(--font-mono),monospace" }}>{c}</span>
                  </div>
                );
              })}

              {triaged === 0 && (
                <p style={{ fontSize: 13, color: C.textMut, textAlign: "center", lineHeight: 1.6 }}>
                  No triage results yet.<br/>Click <strong style={{ color: C.accent }}>Triage</strong> on any finding below.
                </p>
              )}

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.textMut, lineHeight: 1.6 }}>
                ⏳ AI-generated · pending review &nbsp; · &nbsp; ✓ human-approved
              </div>
            </div>
          </div>
        </div>

        {/* ── findings table ── */}
        <div style={box}>
          <div style={{ padding: "14px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Findings</span>
            <span style={{ fontSize: 11, color: C.textMut, fontFamily: "var(--font-mono),monospace" }}>{findings.length} shown</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  <th style={{ width: 4, padding: 0 }} />
                  {["Severity","Repo","Title","Type","Scanner","Status","Triage","Last seen"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: C.textMut, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {findings.map(f => {
                  const sv = (SEV as Record<string,{stripe:string;text:string;label:string}>)[f.severity] ?? SEV.informational;
                  const st = (STATUS as Record<string,{bg:string;color:string;label:string}>)[f.status] ?? STATUS.open;
                  return (
                    <tr key={f.id} style={{ borderBottom: `1px solid ${C.borderSubtle}` }}>
                      {/* severity stripe */}
                      <td style={{ width: 4, padding: 0, background: sv.stripe }} />
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: sv.text }}>{sv.label}</span>
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontFamily: "var(--font-mono),monospace", fontSize: 12, color: C.textSec }}>{f.repo}</td>
                      <td style={{ padding: "12px 14px", maxWidth: 300 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: C.text, fontWeight: 500 }} title={f.title}>
                          {f.title || f.rule_id || "—"}
                        </div>
                        {f.triage_explanation && (
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: C.textMut, marginTop: 2 }} title={f.triage_explanation}>
                            {f.triage_explanation}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", color: C.textMut, whiteSpace: "nowrap", fontSize: 12 }}>{f.type}</td>
                      <td style={{ padding: "12px 14px", color: C.textMut, whiteSpace: "nowrap", fontSize: 11, fontFamily: "var(--font-mono),monospace" }}>{f.source_scanner}</td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                        {f.triage_priority ? (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                            background: f.triage_approved_at ? "#14392A" : "#2D1F4E",
                            color: f.triage_approved_at ? "#86EFAC" : "#C4B5FD",
                          }}>
                            {f.triage_priority} {f.triage_approved_at ? "✓" : "⏳"}
                          </span>
                        ) : (
                          <form action={`/api/triage/${f.id}`} method="post" style={{ display: "inline" }}>
                            <button type="submit" style={{
                              padding: "3px 10px", borderRadius: 5, fontSize: 11, fontWeight: 600,
                              background: "#1E3A5F", color: "#93C5FD",
                              border: "1px solid #2563EB", cursor: "pointer",
                            }}>Triage</button>
                          </form>
                        )}
                      </td>
                      <td style={{ padding: "12px 14px", whiteSpace: "nowrap", fontSize: 11, color: C.textMut, fontFamily: "var(--font-mono),monospace" }}>
                        {fmt(f.last_seen)}
                      </td>
                    </tr>
                  );
                })}
                {findings.length === 0 && (
                  <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: C.textMut }}>No findings yet — run a scan first</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── footer actions ── */}
        <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
          {[
            { href: "/api/connectors/github/install", label: "+ Connect GitHub Org" },
            { href: "/api/connectors/aws", label: "Download AWS Template" },
          ].map(({ href, label }) => (
            <a key={href} href={href} style={{
              padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: C.surface, color: C.textSec,
              border: `1px solid ${C.border}`, textDecoration: "none",
            }}>{label}</a>
          ))}
        </div>
      </main>
    </div>
  );
}
