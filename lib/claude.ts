/**
 * AI triage wrapper — currently using OpenRouter free tier for dogfooding.
 * ponytail: replace MODEL + client with claude-haiku-4-5 via @anthropic-ai/sdk before GA (CLAUDE.md §2)
 *
 * Enforces FR-5 (citation required) and tracks token cost per tenant ($40/mo budget).
 */
import OpenAI from "openai";
import pool from "./db";

// ponytail: swap to claude-haiku-4-5-20251001 via Anthropic SDK before GA
const client = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY,
});

const MODEL = "llama-3.3-70b-versatile";
// Approximate cost for free tier (effectively $0 — update when switching to Claude)
const INPUT_COST_PER_M = 0;
const OUTPUT_COST_PER_M = 0;

export interface Citation {
  rule_id: string;
  source: string;
  url?: string;
}

export interface TriageOutput {
  explanation: string;
  priority: "immediate" | "high" | "medium" | "low";
  confidence: number;
  citations: Citation[];
  raw_response: unknown;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

const SYSTEM = `You are a security triage analyst. Given a security finding, output a JSON object with exactly these fields:
- explanation: plain-English explanation (2-4 sentences) of what this finding means and why it matters
- priority: one of "immediate", "high", "medium", "low"
- confidence: number 0.0-1.0
- citations: array of objects each with "rule_id" (e.g. "CVE-2023-1234", "CWE-79", or the scanner rule ID), "source" (e.g. "NVD", "OWASP", "semgrep"), and optional "url"

CRITICAL: citations must have at least one entry. Output only valid JSON, no markdown fences.`;

export async function triageFinding(
  tenantId: string,
  findingId: string,
  finding: {
    type: string;
    severity: string;
    title: string;
    rule_id: string | null;
    asset: string;
    raw: unknown;
  },
  controlContext?: string
): Promise<TriageOutput> {
  const userMsg = `Finding:
Type: ${finding.type}
Severity: ${finding.severity}
Title: ${finding.title}
Rule ID: ${finding.rule_id ?? "unknown"}
Asset: ${finding.asset}
Raw scanner output: ${JSON.stringify(finding.raw).slice(0, 2000)}
${controlContext ? `\nRelevant compliance controls:\n${controlContext}` : ""}

Provide triage as JSON.`;

  const resp = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userMsg },
    ],
    max_tokens: 1024,
  });

  const text = resp.choices[0]?.message?.content ?? "";
  // Strip markdown fences if the model adds them despite instruction
  const json = text.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();

  let parsed: Omit<TriageOutput, "raw_response" | "model" | "input_tokens" | "output_tokens" | "cost_usd">;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Model returned non-JSON: ${text.slice(0, 200)}`);
  }

  // FR-5 hard enforcement
  if (!parsed.citations || parsed.citations.length === 0) {
    throw new Error("Triage result missing required citation (FR-5)");
  }

  const input_tokens = resp.usage?.prompt_tokens ?? 0;
  const output_tokens = resp.usage?.completion_tokens ?? 0;
  const cost_usd = (input_tokens / 1_000_000) * INPUT_COST_PER_M +
                   (output_tokens / 1_000_000) * OUTPUT_COST_PER_M;

  await pool.query(
    `INSERT INTO api_usage (tenant_id, model, input_tokens, output_tokens, cost_usd, operation, finding_id)
     VALUES ($1, $2, $3, $4, $5, 'triage', $6)`,
    [tenantId, MODEL, input_tokens, output_tokens, cost_usd, findingId]
  );

  return {
    ...parsed,
    raw_response: parsed,
    model: MODEL,
    input_tokens,
    output_tokens,
    cost_usd,
  };
}

export async function getMonthSpend(tenantId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(cost_usd), 0) AS spend
     FROM api_usage
     WHERE tenant_id = $1 AND date_trunc('month', created_at) = date_trunc('month', now())`,
    [tenantId]
  );
  return Number(rows[0]?.spend ?? 0);
}
