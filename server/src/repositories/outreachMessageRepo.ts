import { query } from '../db/pool';

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

export interface OutreachMessageRow {
  id: string;
  business_id: string;
  campaign_contact_id: string;
  draft_id: string | null;
  provider: string;
  provider_message_id: string | null;
  thread_id: string | null;
  subject: string;
  body: string;
  status: MessageStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  failed_reason: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

export async function findByIdempotencyKey(businessId: string, idempotencyKey: string): Promise<OutreachMessageRow | null> {
  const result = await query<OutreachMessageRow>(`SELECT * FROM outreach_messages WHERE business_id = $1 AND idempotency_key = $2`, [businessId, idempotencyKey]);
  return result.rows[0] ?? null;
}

export async function createMessage(input: {
  businessId: string;
  campaignContactId: string;
  draftId: string;
  provider: string;
  subject: string;
  body: string;
  idempotencyKey: string;
}): Promise<OutreachMessageRow> {
  const result = await query<OutreachMessageRow>(
    `INSERT INTO outreach_messages (business_id, campaign_contact_id, draft_id, provider, subject, body, idempotency_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [input.businessId, input.campaignContactId, input.draftId, input.provider, input.subject, input.body, input.idempotencyKey]
  );
  return result.rows[0];
}

export async function markSent(id: string, providerMessageId: string | null, threadId: string | null): Promise<OutreachMessageRow> {
  const result = await query<OutreachMessageRow>(
    `UPDATE outreach_messages SET status = 'sent', provider_message_id = $1, thread_id = $2, sent_at = now(), updated_at = now() WHERE id = $3 RETURNING *`,
    [providerMessageId, threadId, id]
  );
  return result.rows[0];
}

export async function markDelivered(id: string): Promise<void> {
  await query(`UPDATE outreach_messages SET status = 'delivered', delivered_at = now(), updated_at = now() WHERE id = $1`, [id]);
}

export async function markFailed(id: string, reason: string): Promise<void> {
  await query(`UPDATE outreach_messages SET status = 'failed', failed_reason = $1, updated_at = now() WHERE id = $2`, [reason, id]);
}

export async function markBounced(id: string, reason: string): Promise<void> {
  await query(`UPDATE outreach_messages SET status = 'bounced', failed_reason = $1, updated_at = now() WHERE id = $2`, [reason, id]);
}

export async function findByProviderMessageId(businessId: string, providerMessageId: string): Promise<OutreachMessageRow | null> {
  const result = await query<OutreachMessageRow>(`SELECT * FROM outreach_messages WHERE business_id = $1 AND provider_message_id = $2`, [businessId, providerMessageId]);
  return result.rows[0] ?? null;
}

export async function listForCampaignContact(campaignContactId: string): Promise<OutreachMessageRow[]> {
  const result = await query<OutreachMessageRow>(`SELECT * FROM outreach_messages WHERE campaign_contact_id = $1 ORDER BY created_at ASC`, [campaignContactId]);
  return result.rows;
}

export async function listForBusiness(businessId: string, limit = 100): Promise<OutreachMessageRow[]> {
  const result = await query<OutreachMessageRow>(`SELECT * FROM outreach_messages WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`, [businessId, limit]);
  return result.rows;
}
