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

export interface OutreachMessageWithRecipient extends OutreachMessageRow {
  recipient_email: string;
  recipient_name: string | null;
  lead_id: string | null;
  campaign_name: string;
}

/**
 * Every outgoing message for the business, with recipient/lead context
 * attached — backs the Sent folder. When `restrictToUserId` is set (sales
 * role), only messages whose linked lead is assigned to that user are
 * returned; a message with no linked lead at all (bulk campaign contact
 * never tied to a CRM lead) is excluded for a restricted viewer since
 * there's no assignment to check it against.
 */
export async function listForBusinessWithRecipient(
  businessId: string,
  opts: { limit?: number; restrictToUserId?: string } = {}
): Promise<OutreachMessageWithRecipient[]> {
  const conditions = ['m.business_id = $1'];
  const values: unknown[] = [businessId];

  if (opts.restrictToUserId) {
    conditions.push(`l.assigned_user_id = $${values.length + 1}`);
    values.push(opts.restrictToUserId);
  }

  values.push(opts.limit ?? 200);

  const result = await query<OutreachMessageWithRecipient>(
    `SELECT m.*, oc.email AS recipient_email, oc.contact_name AS recipient_name, oc.lead_id, c.name AS campaign_name
     FROM outreach_messages m
     JOIN outreach_campaign_contacts cc ON cc.id = m.campaign_contact_id
     JOIN outreach_contacts oc ON oc.id = cc.contact_id
     JOIN outreach_campaigns c ON c.id = cc.campaign_id
     LEFT JOIN leads l ON l.id = oc.lead_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY m.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}

/** How many emails were actually delivered to this contact across every campaign enrollment. Used to stop a second first-contact email. */
export async function countSentForContact(businessId: string, contactId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(m.id)::text AS count FROM outreach_messages m
     JOIN outreach_campaign_contacts cc ON cc.id = m.campaign_contact_id
     WHERE m.business_id = $1 AND cc.contact_id = $2 AND m.status IN ('sent', 'delivered', 'bounced')`,
    [businessId, contactId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

/** Every outgoing message ever sent to one outreach contact, across every campaign_contact enrollment (bulk campaigns and direct lead sends alike). */
export async function listForContact(businessId: string, contactId: string): Promise<OutreachMessageRow[]> {
  const result = await query<OutreachMessageRow>(
    `SELECT m.* FROM outreach_messages m
     JOIN outreach_campaign_contacts cc ON cc.id = m.campaign_contact_id
     WHERE m.business_id = $1 AND cc.contact_id = $2
     ORDER BY m.created_at ASC`,
    [businessId, contactId]
  );
  return result.rows;
}
