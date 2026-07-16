"use client";

import { useEffect, useState } from "react";

const C = {
  bg:      "#0F172A",
  surface: "#1E293B",
  border:  "#334155",
  muted:   "#64748B",
  text:    "#F1F5F9",
  sub:     "#94A3B8",
  accent:  "#38BDF8",
  green:   "#34D399",
  amber:   "#FBBF24",
  red:     "#F87171",
} as const;

function statusColor(s: string) {
  if (s === "up")       return C.green;
  if (s === "degraded") return C.amber;
  return C.red;
}

function impactColor(i: string) {
  if (i === "critical") return C.red;
  if (i === "major")    return C.amber;
  if (i === "minor")    return "#FB923C";
  return C.muted;
}

interface StatusData {
  services: Array<{ service: string; status: string; latency_ms: number | null; checked_at: string }>;
  uptime: Array<{ service: string; uptime_30d: number }>;
  incidents: Array<{ id: string; title: string; impact: string; status: string; body: string | null; started_at: string; resolved_at: string | null }>;
}

const SERVICE_LABELS: Record<string, string> = {
  control_plane: "Control Plane",
  scan_pipeline: "Scan Pipeline",
  ai_triage:     "AI Triage Agent",
};

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const nav: React.CSSProperties = {
    background: "#0F172ACC",
    backdropFilter: "blur(12px)",
    borderBottom: `1px solid ${C.border}`,
    display: "flex", alignItems: "center", gap: 12,
    padding: "0 24px", height: 56,
  };

  const card: React.CSSProperties = {
    background: C.surface, borderRadius: 10, border: `1px solid ${C.border}`, padding: 24,
  };

  const overallStatus = data?.services.every((s) => s.status === "up")
    ? "All Systems Operational"
    : data?.services.some((s) => s.status === "down")
    ? "Partial Outage"
    : "Degraded Performance";

  const overallColor = data?.services.every((s) => s.status === "up")
    ? C.green
    : data?.services.some((s) => s.status === "down")
    ? C.red : C.amber;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "var(--font-inter, system-ui, sans-serif)" }}>
      <nav style={nav}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
            fill="#1E40AF" stroke={C.accent} strokeWidth="1.5"/>
          <path d="M9 12l2 2 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.02em" }}>Sentinel8</span>
        <span style={{ marginLeft: 8, padding: "2px 8px", background: "#1E3A5F", color: C.accent, borderRadius: 4, fontSize: 11, fontWeight: 600 }}>STATUS</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 13, color: C.sub }}>
          <a href="/dashboard" style={{ color: C.sub, textDecoration: "none" }}>Dashboard</a>
          <a href="/portal" style={{ color: C.sub, textDecoration: "none" }}>Portal</a>
        </div>
      </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Overall status banner */}
        <div style={{
          ...card,
          borderLeft: `4px solid ${data ? overallColor : C.border}`,
          display: "flex", alignItems: "center", gap: 16,
        }}>
          {data && (
            <div style={{ width: 12, height: 12, borderRadius: "50%", background: overallColor, boxShadow: `0 0 8px ${overallColor}` }} />
          )}
          <div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {loading ? "Checking status…" : overallStatus}
            </div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>
              Last updated: {data ? new Date(data.services[0]?.checked_at ?? Date.now()).toLocaleTimeString() : "—"}
            </div>
          </div>
        </div>

        {/* Per-service status */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>SERVICES</div>
          {loading ? (
            <p style={{ color: C.sub, fontSize: 13 }}>Loading…</p>
          ) : data?.services.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13 }}>No uptime data recorded yet. Waiting for first cron ping.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {(["control_plane", "scan_pipeline", "ai_triage"] as const).map((svc) => {
                const s = data?.services.find((x) => x.service === svc);
                const up = data?.uptime.find((x) => x.service === svc);
                return (
                  <div key={svc} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "14px 0", borderBottom: `1px solid ${C.border}`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: "50%",
                        background: s ? statusColor(s.status) : C.muted,
                        boxShadow: s && s.status === "up" ? `0 0 6px ${C.green}` : "none",
                      }} />
                      <span style={{ fontWeight: 500 }}>{SERVICE_LABELS[svc] ?? svc}</span>
                    </div>
                    <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 13 }}>
                      {s?.latency_ms != null && (
                        <span style={{ color: C.muted, fontVariantNumeric: "tabular-nums" }}>{s.latency_ms}ms</span>
                      )}
                      {up && (
                        <span style={{ color: up.uptime_30d >= 99.9 ? C.green : C.amber, fontWeight: 600 }}>
                          {up.uptime_30d}% uptime (30d)
                        </span>
                      )}
                      <span style={{
                        fontWeight: 600, fontSize: 12,
                        color: s ? statusColor(s.status) : C.muted,
                      }}>
                        {s ? s.status.toUpperCase() : "NO DATA"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incident history */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, letterSpacing: "0.08em", marginBottom: 16 }}>INCIDENT HISTORY</div>
          {!data || data.incidents.length === 0 ? (
            <p style={{ color: C.sub, fontSize: 13 }}>No incidents recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {data.incidents.map((inc) => (
                <div key={inc.id} style={{ padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 3,
                      background: `${impactColor(inc.impact)}20`, color: impactColor(inc.impact),
                    }}>{inc.impact.toUpperCase()}</span>
                    <span style={{ fontWeight: 600 }}>{inc.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600,
                      color: inc.status === "resolved" ? C.green : C.amber,
                    }}>{inc.status}</span>
                  </div>
                  {inc.body && <p style={{ fontSize: 13, color: C.sub, margin: 0 }}>{inc.body}</p>}
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
                    {new Date(inc.started_at).toLocaleString()}
                    {inc.resolved_at && ` → resolved ${new Date(inc.resolved_at).toLocaleString()}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: C.muted, textAlign: "center" }}>
          Sentinel8 meets its own uptime promises — this page is backed by real control-plane data, not a separate monitoring service.
        </p>
      </div>
    </div>
  );
}
