"use client";

import { useEffect, useState, useCallback } from "react";

const C = {
  bg:       "#0F172A",
  surface:  "#1E293B",
  border:   "#334155",
  muted:    "#64748B",
  text:     "#F1F5F9",
  sub:      "#94A3B8",
  accent:   "#38BDF8",
  green:    "#34D399",
  amber:    "#FBBF24",
  red:      "#F87171",
  orange:   "#FB923C",
} as const;

const SEV: Record<string, { label: string; color: string }> = {
  critical: { label: "CRIT", color: C.red },
  high:     { label: "HIGH", color: C.orange },
  medium:   { label: "MED",  color: C.amber },
  low:      { label: "LOW",  color: C.green },
};

function scoreColor(score: number) {
  if (score >= 80) return C.green;
  if (score >= 50) return C.amber;
  return C.red;
}

// ponytail: hardcoded tenant for dogfood — add tenant picker when external clients onboard
const TENANT_ID = process.env.NEXT_PUBLIC_DOGFOOD_TENANT_ID ?? "";

interface PostureData {
  score: { score: number; open_critical: number; open_high: number; open_medium: number; open_low: number };
  trend: Array<{ snapped_at: string; score: number }>;
  coverage: Array<{ framework: string; total_controls: number; mapped_controls: number; coverage_pct: number }>;
  queue: Array<{ id: string; title: string; severity: string; status: string; finding_type: string; asset_name: string; last_seen_at: string }>;
}

function SparkLine({ points }: { points: Array<{ score: number }> }) {
  if (points.length < 2) return <span style={{ color: C.muted, fontSize: 12 }}>No history yet</span>;
  const vals = points.map((p) => p.score);
  const min = Math.min(...vals);
  const max = Math.max(...vals) || 100;
  const W = 200, H = 40;
  const xs = vals.map((_, i) => (i / (vals.length - 1)) * W);
  const ys = vals.map((v) => H - ((v - min) / (max - min || 1)) * H);
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x},${ys[i]}`).join(" ");
  const last = vals[vals.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scoreColor(last)} stopOpacity="0.3" />
          <stop offset="100%" stopColor={scoreColor(last)} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`${d} L${W},${H} L0,${H} Z`}
        fill="url(#spark-fill)"
      />
      <path d={d} stroke={scoreColor(last)} strokeWidth="2" fill="none" strokeLinejoin="round" />
      <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="3" fill={scoreColor(last)} />
    </svg>
  );
}

export default function PortalPage() {
  const [data, setData] = useState<PostureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [auditMsg, setAuditMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!TENANT_ID) {
      setError("NEXT_PUBLIC_DOGFOOD_TENANT_ID not set");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/posture?tenantId=${TENANT_ID}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generatePack(framework: string) {
    setGenerating(true);
    setAuditMsg(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const res = await fetch("/api/audit-packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: TENANT_ID, framework, periodStart: start, periodEnd: today, generatedBy: "portal-user" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const { pack } = await res.json();
      setAuditMsg(`Draft audit pack created (${pack.id.slice(0, 8)}…) — pending human review before export (FR-8)`);
    } catch (e) {
      setAuditMsg(`Error: ${e}`);
    } finally {
      setGenerating(false);
    }
  }

  const nav: React.CSSProperties = {
    position: "sticky", top: 0, zIndex: 10,
    background: "#0F172ACC",
    backdropFilter: "blur(12px)",
    borderBottom: `1px solid ${C.border}`,
    display: "flex", alignItems: "center", gap: 12,
    padding: "0 24px", height: 56,
  };

  const card: React.CSSProperties = {
    background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24,
  };

  if (loading) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>
      Loading posture data…
    </div>
  );

  if (error) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.red, padding: 32 }}>
      {error}
    </div>
  );

  const { score, trend, coverage, queue } = data!;
  const sc = scoreColor(score.score);

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      {/* Nav */}
      <nav style={nav}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
            fill="#1E40AF" stroke={C.accent} strokeWidth="1.5"/>
          <path d="M9 12l2 2 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>Sentinel8</span>
        <span style={{ marginLeft: 8, padding: "2px 8px", background: "#1E3A5F", color: C.accent, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>POSTURE PORTAL</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 13, color: C.sub }}>
          <a href="/dashboard" style={{ color: C.sub, textDecoration: "none" }}>Dashboard</a>
          <a href="/status" style={{ color: C.sub, textDecoration: "none" }}>Status</a>
        </div>
      </nav>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Posture score + sparkline */}
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 24 }}>
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 32 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 56, fontWeight: 800, color: sc, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                {score.score}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginTop: 4 }}>POSTURE SCORE</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Critical", val: score.open_critical, color: C.red },
                { label: "High",     val: score.open_high,     color: C.orange },
                { label: "Medium",   val: score.open_medium,   color: C.amber },
                { label: "Low",      val: score.open_low,      color: C.green },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ color: C.sub, minWidth: 56 }}>{label}</span>
                  <span style={{ fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ ...card }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>30-DAY TREND</div>
            <SparkLine points={trend} />
            {trend.length >= 2 && (
              <div style={{ marginTop: 8, fontSize: 12, color: C.sub }}>
                {trend[0].snapped_at} → {trend[trend.length - 1].snapped_at}
              </div>
            )}
          </div>
        </div>

        {/* Framework coverage */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>FRAMEWORK COVERAGE</div>
          {coverage.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13 }}>No control mappings yet — run a scan to populate.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {coverage.map((fw) => (
                <div key={fw.framework}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>{fw.framework}</span>
                    <span style={{ color: C.sub }}>{fw.mapped_controls}/{fw.total_controls} controls — <span style={{ color: fw.coverage_pct >= 70 ? C.green : C.amber, fontWeight: 700 }}>{fw.coverage_pct}%</span></span>
                  </div>
                  <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${fw.coverage_pct}%`, height: "100%", background: fw.coverage_pct >= 70 ? C.green : C.amber, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit pack export */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>AUDIT PACK EXPORT</div>
          <p style={{ fontSize: 13, color: C.sub, marginBottom: 16 }}>
            Generates a draft evidence pack. Human review and approval required before export (FR-8).
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["SOC2", "GDPR", "DPDP"].map((fw) => (
              <button
                key={fw}
                disabled={generating}
                onClick={() => generatePack(fw)}
                style={{
                  padding: "8px 18px", borderRadius: 6, fontSize: 13, fontWeight: 600,
                  background: generating ? C.border : "#1E3A5F",
                  color: generating ? C.muted : C.accent,
                  border: `1px solid ${C.accent}40`,
                  cursor: generating ? "not-allowed" : "pointer",
                }}
              >
                {generating ? "Generating…" : `Generate ${fw}`}
              </button>
            ))}
          </div>
          {auditMsg && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#1E293B", borderRadius: 6, fontSize: 13, color: C.sub, borderLeft: `3px solid ${C.accent}` }}>
              {auditMsg}
            </div>
          )}
        </div>

        {/* Remediation queue */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>
            REMEDIATION QUEUE — {queue.length} open
          </div>
          {queue.length === 0 ? (
            <p style={{ color: C.green, fontSize: 14 }}>All clear — no open findings.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em" }}>
                    <th style={{ width: 4, padding: 0 }} />
                    <th style={{ padding: "0 12px 10px", textAlign: "left" }}>SEV</th>
                    <th style={{ padding: "0 12px 10px", textAlign: "left" }}>FINDING</th>
                    <th style={{ padding: "0 12px 10px", textAlign: "left" }}>ASSET</th>
                    <th style={{ padding: "0 12px 10px", textAlign: "left" }}>STATUS</th>
                    <th style={{ padding: "0 12px 10px", textAlign: "left" }}>LAST SEEN</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((f) => {
                    const sv = SEV[f.severity] ?? { label: f.severity, color: C.muted };
                    return (
                      <tr key={f.id} style={{ borderTop: `1px solid ${C.border}` }}>
                        <td style={{ width: 4, padding: 0, background: sv.color }} />
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: sv.color }}>{sv.label}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 500, color: C.text, maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.title}
                        </td>
                        <td style={{ padding: "10px 12px", color: C.sub, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                          {f.asset_name ?? "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.amber }}>{f.status}</span>
                        </td>
                        <td style={{ padding: "10px 12px", color: C.muted, fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                          {new Date(f.last_seen_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
