import { query } from '../db/pool';

export interface WebhookRow {
  id: string;
  business_id: string;
  secret_hash: string;
  secret_prefix: string;
  is_active: boolean;
  last_delivery_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  business_id: string;
  status: 'Success' | 'Failed';
  payload: unknown;
  error: string | null;
  lead_id: string | null;
  created_at: string;
}

export async function findWebhookByBusiness(businessId: string): Promise<WebhookRow | null> {
  const result = await query<WebhookRow>(`SELECT * FROM webhooks WHERE business_id = $1`, [businessId]);
  return result.rows[0] ?? null;
}

export async function findWebhookBySecretHash(secretHash: string): Promise<WebhookRow | null> {
  const result = await query<WebhookRow>(`SELECT * FROM webhooks WHERE secret_hash = $1 AND is_active = true`, [secretHash]);
  return result.rows[0] ?? null;
}

export async function upsertWebhook(businessId: string, secretHash: string, secretPrefix: string): Promise<WebhookRow> {
  const existing = await findWebhookByBusiness(businessId);
  if (existing) {
    const result = await query<WebhookRow>(
      `UPDATE webhooks SET secret_hash = $1, secret_prefix = $2, is_active = true, updated_at = now() WHERE business_id = $3 RETURNING *`,
      [secretHash, secretPrefix, businessId]
    );
    return result.rows[0];
  }
  const result = await query<WebhookRow>(
    `INSERT INTO webhooks (business_id, secret_hash, secret_prefix) VALUES ($1, $2, $3) RETURNING *`,
    [businessId, secretHash, secretPrefix]
  );
  return result.rows[0];
}

export async function setWebhookActive(businessId: string, isActive: boolean): Promise<WebhookRow | null> {
  const result = await query<WebhookRow>(
    `UPDATE webhooks SET is_active = $1, updated_at = now() WHERE business_id = $2 RETURNING *`,
    [isActive, businessId]
  );
  return result.rows[0] ?? null;
}

export async function recordDelivery(input: {
  webhookId: string;
  businessId: string;
  status: 'Success' | 'Failed';
  payload?: unknown;
  error?: string | null;
  leadId?: string | null;
}): Promise<WebhookDeliveryRow> {
  const result = await query<WebhookDeliveryRow>(
    `INSERT INTO webhook_deliveries (webhook_id, business_id, status, payload, error, lead_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [input.webhookId, input.businessId, input.status, JSON.stringify(input.payload ?? null), input.error ?? null, input.leadId ?? null]
  );
  await query(`UPDATE webhooks SET last_delivery_at = now() WHERE id = $1`, [input.webhookId]);
  return result.rows[0];
}

export async function listDeliveries(businessId: string, limit = 25): Promise<WebhookDeliveryRow[]> {
  const result = await query<WebhookDeliveryRow>(
    `SELECT * FROM webhook_deliveries WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [businessId, limit]
  );
  return result.rows;
}
