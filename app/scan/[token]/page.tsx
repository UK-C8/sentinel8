"use client";

import { useEffect, useState, use } from "react";

const C = {
  bg: "#0F172A", surface: "#1E293B", border: "#334155", muted: "#64748B",
  text: "#F1F5F9", sub: "#94A3B8", accent: "#38BDF8",
  red: "#F87171", orange: "#FB923C", amber: "#FBBF24", green: "#34D399",
} as const;

const SEV: Record<string, { label: string; color: string }> = {
  critical: { label: "Critical", color: C.red },
  high:     { label: "High",     color: C.orange },
  medium:   { label: "Medium",   color: C.amber },
  low:      { label: "Low",      color: C.green },
};

interface Finding {
  severity: string; scanner: string; type: string;
  title: string; rule_id: string; asset: string;
}
interface ScanResult {
  repo: string;
  status: string;
  counts: { critical: number; high: number; medium: number; low: number; total: number };
  findings: Finding[];
  error: string | null;
  completedAt: string | null;
}

export default function ScanReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [data, setData] = useState<ScanResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      const res = await fetch(`/api/free-scan/${token}`);
      if (!alive) return;
      if (res.status === 404) { setNotFound(true); return; }
      const d: ScanResult = await res.json();
      setData(d);
      if (d.status === "pending" || d.status === "running") setTimeout(poll, 3000);
    }
    poll();
    return () => { alive = false; };
  }, [token]);

  async function downloadPdf() {
    if (!data) return;
    setPdfBusy(true);
    try {
      const { downloadScanPdf } = await import("@/lib/scan-pdf");
      await downloadScanPdf({
        repo: data.repo, counts: data.counts, findings: data.findings, completedAt: data.completedAt,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  const card: React.CSSProperties = { background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24 };

  if (notFound) return <Centered>Scan not found.</Centered>;
  if (!data) return <Centered>Loading…</Centered>;

  const running = data.status === "pending" || data.status === "running";

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#1E40AF" stroke={C.accent} strokeWidth="1.5"/>
          <path d="M9 12l2 2 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Sentinel8</span>
        <a href="/scan" style={{ marginLeft: "auto", color: C.sub, textDecoration: "none", fontSize: 13 }}>New scan</a>
      </nav>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.06em", fontWeight: 600 }}>SECURITY SCAN</div>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: "6px 0 0", fontFamily: "var(--font-mono, monospace)" }}>{data.repo}</h1>
          </div>
          {data.status === "completed" && (
            <button onClick={downloadPdf} disabled={pdfBusy} style={{
              padding: "10px 22px", fontSize: 14, fontWeight: 700, borderRadius: 8,
              background: pdfBusy ? C.border : C.accent, color: pdfBusy ? C.muted : "#06131F",
              border: "none", cursor: pdfBusy ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            }}>
              {pdfBusy ? "Building PDF…" : "↓ Download PDF"}
            </button>
          )}
        </div>

        {running && (
          <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
            <Spinner />
            <div>
              <div style={{ fontWeight: 600 }}>Scanning…</div>
              <div style={{ fontSize: 13, color: C.sub }}>Running Trivy, Semgrep &amp; Gitleaks. This page updates automatically.</div>
            </div>
          </div>
        )}

        {data.status === "failed" && (
          <div style={{ ...card, borderLeft: `3px solid ${C.red}` }}>
            <div style={{ fontWeight: 600, color: C.red }}>Scan failed</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
              We couldn&apos;t clone or scan this repo. Make sure it&apos;s a public repository.
            </div>
          </div>
        )}

        {data.status === "completed" && (
          <>
            {/* Severity summary tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
              {(["critical", "high", "medium", "low"] as const).map((k) => (
                <div key={k} style={{ ...card, padding: 18, borderTop: `3px solid ${SEV[k].color}` }}>
                  <div style={{ fontSize: 30, fontWeight: 800, color: SEV[k].color, fontVariantNumeric: "tabular-nums" }}>
                    {data.counts[k]}
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, fontWeight: 600, marginTop: 2 }}>{SEV[k].label}</div>
                </div>
              ))}
            </div>

            {/* Full findings list */}
            <div style={card}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.06em", marginBottom: 14 }}>
                ALL FINDINGS — {data.counts.total}
              </div>
              {data.findings.length === 0 ? (
                <p style={{ color: C.green, fontSize: 14 }}>No findings surfaced — this repo looks clean. 🎉</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: "0.05em" }}>
                        <th style={{ width: 4, padding: 0 }} />
                        <th style={{ padding: "0 12px 10px", textAlign: "left" }}>SEV</th>
                        <th style={{ padding: "0 12px 10px", textAlign: "left" }}>FINDING</th>
                        <th style={{ padding: "0 12px 10px", textAlign: "left" }}>LOCATION</th>
                        <th style={{ padding: "0 12px 10px", textAlign: "left" }}>SCANNER</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.findings.map((f, i) => {
                        const sv = SEV[f.severity] ?? { label: f.severity, color: C.muted };
                        return (
                          <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                            <td style={{ width: 4, padding: 0, background: sv.color }} />
                            <td style={{ padding: "10px 12px" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: sv.color }}>{sv.label}</span>
                            </td>
                            <td style={{ padding: "10px 12px", color: C.text }}>{f.title}</td>
                            <td style={{ padding: "10px 12px", color: C.sub, fontFamily: "var(--font-mono, monospace)", fontSize: 12, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {f.asset}
                            </td>
                            <td style={{ padding: "10px 12px", color: C.muted, fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>
                              {f.scanner}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <p style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
              Free scan · findings are location-only and contain no secret values · shareable link
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub, fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{
      width: 20, height: 20, borderRadius: "50%",
      border: `2px solid ${C.border}`, borderTopColor: C.accent,
      animation: "spin 0.8s linear infinite",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
