import { query } from '../db/pool';

export interface ApiKeyRow {
  id: string;
  business_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export async function listApiKeys(businessId: string): Promise<Omit<ApiKeyRow, 'key_hash'>[]> {
  const result = await query<Omit<ApiKeyRow, 'key_hash'>>(
    `SELECT id, business_id, name, key_prefix, created_by, last_used_at, revoked_at, created_at
     FROM api_keys WHERE business_id = $1 ORDER BY created_at DESC`,
    [businessId]
  );
  return result.rows;
}

export async function createApiKey(input: { businessId: string; name: string; keyPrefix: string; keyHash: string; createdBy: string }): Promise<ApiKeyRow> {
  const result = await query<ApiKeyRow>(
    `INSERT INTO api_keys (business_id, name, key_prefix, key_hash, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.businessId, input.name, input.keyPrefix, input.keyHash, input.createdBy]
  );
  return result.rows[0];
}

export async function findActiveApiKeyByPrefix(keyPrefix: string): Promise<ApiKeyRow | null> {
  const result = await query<ApiKeyRow>(
    `SELECT * FROM api_keys WHERE key_prefix = $1 AND revoked_at IS NULL`,
    [keyPrefix]
  );
  return result.rows[0] ?? null;
}

export async function touchApiKey(id: string): Promise<void> {
  await query(`UPDATE api_keys SET last_used_at = now() WHERE id = $1`, [id]);
}

export async function revokeApiKey(id: string, businessId: string): Promise<boolean> {
  const result = await query(
    `UPDATE api_keys SET revoked_at = now() WHERE id = $1 AND business_id = $2 AND revoked_at IS NULL`,
    [id, businessId]
  );
  return (result.rowCount ?? 0) > 0;
}
