/**
 * Evidence artifact generation for control mappings.
 * Status gate: draft → human_reviewed → approved before export (FR-8).
 * AI-generated content carries a provisional marker until approved.
 */
import pool from "./db";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-haiku-4-5-20251001";

export async function generateEvidenceDraft(
  tenantId: string,
  controlMappingId: string,
  framework: string,
  controlId: string,
  controlName: string,
  findingsSummary: string
): Promise<string> {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `Generate a compliance evidence artifact for ${framework} control ${controlId} (${controlName}).

The following security findings are relevant to this control:
${findingsSummary}

Write a concise evidence artifact (150-250 words) suitable for an auditor. Include:
1. What control this covers and what evidence demonstrates compliance or gap
2. Current status (compliant, partially compliant, or gap exists)
3. Findings that triggered this assessment with their IDs
4. Recommended remediation steps if gaps exist

Start with: "DRAFT — AI-generated, pending human review"`
    }],
  });

  const content = resp.content.find((b) => b.type === "text")?.text ?? "";

  // Track token cost
  const cost = (resp.usage.input_tokens / 1_000_000) * 0.8 +
               (resp.usage.output_tokens / 1_000_000) * 4.0;
  await pool.query(
    `INSERT INTO api_usage (tenant_id, model, input_tokens, output_tokens, cost_usd, operation)
     VALUES ($1, $2, $3, $4, $5, 'evidence')`,
    [tenantId, MODEL, resp.usage.input_tokens, resp.usage.output_tokens, cost]
  );

  // Insert as draft — status='draft' until human approves (FR-8)
  await pool.query(
    `INSERT INTO evidence_drafts (control_mapping_id, tenant_id, content, status)
     VALUES ($1, $2, $3, 'draft')
     ON CONFLICT DO NOTHING`,
    [controlMappingId, tenantId, JSON.stringify({ text: content, generated_at: new Date().toISOString() })]
  );

  return content;
}

export async function approveEvidence(
  evidenceDraftId: string,
  reviewedBy: string
): Promise<void> {
  await pool.query(
    `UPDATE evidence_drafts
     SET status = 'approved', reviewed_by = $2, reviewed_at = now()
     WHERE id = $1 AND status IN ('draft', 'human_reviewed')`,
    [evidenceDraftId, reviewedBy]
  );
}
