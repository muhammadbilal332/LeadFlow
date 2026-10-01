import { query } from '../db/pool';

export interface IntegrationRow {
  id: string;
  business_id: string;
  provider: 'meta' | 'n8n';
  status: 'Connected' | 'Disconnected';
  external_account_id: string | null;
  config: Record<string, unknown>;
  access_token_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

export async function listIntegrations(businessId: string): Promise<IntegrationRow[]> {
  const result = await query<IntegrationRow>(`SELECT * FROM integrations WHERE business_id = $1`, [businessId]);
  return result.rows;
}

export async function findIntegration(businessId: string, provider: 'meta' | 'n8n'): Promise<IntegrationRow | null> {
  const result = await query<IntegrationRow>(`SELECT * FROM integrations WHERE business_id = $1 AND provider = $2`, [businessId, provider]);
  return result.rows[0] ?? null;
}

export async function findIntegrationByExternalAccount(provider: 'meta' | 'n8n', externalAccountId: string): Promise<IntegrationRow | null> {
  const result = await query<IntegrationRow>(
    `SELECT * FROM integrations WHERE provider = $1 AND external_account_id = $2 AND status = 'Connected'`,
    [provider, externalAccountId]
  );
  return result.rows[0] ?? null;
}

export async function upsertIntegration(input: {
  businessId: string;
  provider: 'meta' | 'n8n';
  status: 'Connected' | 'Disconnected';
  externalAccountId?: string | null;
  config?: Record<string, unknown>;
  accessTokenEncrypted?: string | null;
}): Promise<IntegrationRow> {
  const result = await query<IntegrationRow>(
    `INSERT INTO integrations (business_id, provider, status, external_account_id, config, access_token_encrypted)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (business_id, provider) DO UPDATE SET
       status = EXCLUDED.status,
       external_account_id = EXCLUDED.external_account_id,
       config = EXCLUDED.config,
       access_token_encrypted = COALESCE(EXCLUDED.access_token_encrypted, integrations.access_token_encrypted),
       updated_at = now()
     RETURNING *`,
    [
      input.businessId,
      input.provider,
      input.status,
      input.externalAccountId ?? null,
      JSON.stringify(input.config ?? {}),
      input.accessTokenEncrypted ?? null,
    ]
  );
  return result.rows[0];
}
