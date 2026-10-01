import { query } from '../db/pool';

export type SuppressionReason = 'unsubscribe' | 'bounce' | 'manual' | 'complaint' | 'wrong_contact';

export interface SuppressionRow {
  id: string;
  business_id: string;
  normalized_email: string;
  reason: SuppressionReason;
  source: string | null;
  created_at: string;
}

export async function isSuppressed(businessId: string, normalizedEmail: string): Promise<boolean> {
  const result = await query(`SELECT 1 FROM suppressions WHERE business_id = $1 AND normalized_email = $2`, [businessId, normalizedEmail]);
  return (result.rowCount ?? 0) > 0;
}

export async function addSuppression(input: { businessId: string; normalizedEmail: string; reason: SuppressionReason; source?: string | null }): Promise<SuppressionRow> {
  const existing = await query<SuppressionRow>(`SELECT * FROM suppressions WHERE business_id = $1 AND normalized_email = $2`, [input.businessId, input.normalizedEmail]);
  if (existing.rows[0]) return existing.rows[0];

  const result = await query<SuppressionRow>(
    `INSERT INTO suppressions (business_id, normalized_email, reason, source) VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.businessId, input.normalizedEmail, input.reason, input.source ?? null]
  );
  return result.rows[0];
}

export async function removeSuppression(businessId: string, normalizedEmail: string): Promise<boolean> {
  const result = await query(`DELETE FROM suppressions WHERE business_id = $1 AND normalized_email = $2`, [businessId, normalizedEmail]);
  return (result.rowCount ?? 0) > 0;
}

export async function listSuppressions(businessId: string, limit = 200): Promise<SuppressionRow[]> {
  const result = await query<SuppressionRow>(`SELECT * FROM suppressions WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`, [businessId, limit]);
  return result.rows;
}
