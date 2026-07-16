"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const C = {
  bg: "#0F172A", surface: "#1E293B", border: "#334155", muted: "#64748B",
  text: "#F1F5F9", sub: "#94A3B8", accent: "#38BDF8", red: "#F87171",
} as const;

export default function ScanEntryPage() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/free-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed to start");
      router.push(`/scan/${data.token}`);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
      setBusy(false);
    }
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.text, fontFamily: "var(--font-inter, system-ui, sans-serif)", display: "flex", flexDirection: "column" }}>
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "0 24px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#1E40AF" stroke={C.accent} strokeWidth="1.5"/>
          <path d="M9 12l2 2 4-4" stroke={C.accent} strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Sentinel8</span>
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 620, width: "100%", textAlign: "center" }}>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 14, lineHeight: 1.1 }}>
            Scan any public repo for secrets & vulnerabilities
          </h1>
          <p style={{ fontSize: 17, color: C.sub, marginBottom: 32, lineHeight: 1.5 }}>
            Free. No signup. Trivy + Semgrep + Gitleaks run against your repo and return a shareable security summary in minutes.
          </p>

          <form onSubmit={submit} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              disabled={busy}
              style={{
                flex: 1, padding: "14px 16px", fontSize: 15, borderRadius: 8,
                background: C.surface, border: `1px solid ${C.border}`, color: C.text,
                outline: "none", fontFamily: "var(--font-mono, monospace)",
              }}
            />
            <button
              type="submit"
              disabled={busy || !url}
              style={{
                padding: "14px 26px", fontSize: 15, fontWeight: 700, borderRadius: 8,
                background: busy || !url ? C.border : C.accent,
                color: busy || !url ? C.muted : "#06131F",
                border: "none", cursor: busy || !url ? "not-allowed" : "pointer", whiteSpace: "nowrap",
              }}
            >
              {busy ? "Starting…" : "Scan repo"}
            </button>
          </form>

          {err && (
            <div style={{ color: C.red, fontSize: 14, marginTop: 4 }}>{err}</div>
          )}

          <p style={{ fontSize: 12, color: C.muted, marginTop: 24 }}>
            Public github.com / gitlab.com repos only · Rate limited to 5 scans/hour
          </p>
        </div>
      </div>
    </div>
  );
}
