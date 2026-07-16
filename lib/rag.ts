/**
 * RAG retrieval for triage context.
 * Uses Postgres full-text search (GIN index on triage_embeddings.content).
 * Upgrades to pgvector cosine similarity when VOYAGE_API_KEY is set.
 * ponytail: FTS only for now; add Voyage embeddings when semantic gap is measurable
 */
import pool from "./db";

export async function retrieveContext(
  tenantId: string,
  query: string,
  limit = 5
): Promise<string[]> {
  // Full-text search via tsvector GIN index
  const { rows } = await pool.query(
    `SELECT content, ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) AS rank
     FROM triage_embeddings
     WHERE tenant_id = $1
       AND to_tsvector('english', content) @@ plainto_tsquery('english', $2)
     ORDER BY rank DESC
     LIMIT $3`,
    [tenantId, query, limit]
  );
  return rows.map((r) => r.content as string);
}

export async function storeContext(
  tenantId: string,
  findingId: string,
  content: string
): Promise<void> {
  await pool.query(
    `INSERT INTO triage_embeddings (tenant_id, finding_id, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (finding_id) WHERE finding_id IS NOT NULL DO UPDATE SET content = EXCLUDED.content`,
    [tenantId, findingId, content]
  );
}
