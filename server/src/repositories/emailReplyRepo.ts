import { query } from '../db/pool';

export type ReplyClassification = 'interested' | 'meeting_request' | 'question' | 'not_interested' | 'unsubscribe' | 'wrong_person' | 'referral' | 'out_of_office' | 'unknown';

export interface EmailReplyRow {
  id: string;
  business_id: string;
  thread_id: string;
  contact_id: string;
  message_id: string | null;
  from_email: string;
  subject: string | null;
  body: string;
  classification: ReplyClassification;
  provider_reply_id: string | null;
  is_read: boolean;
  created_at: string;
}

export async function findByProviderReplyId(businessId: string, providerReplyId: string): Promise<EmailReplyRow | null> {
  const result = await query<EmailReplyRow>(`SELECT * FROM email_replies WHERE business_id = $1 AND provider_reply_id = $2`, [businessId, providerReplyId]);
  return result.rows[0] ?? null;
}

export async function createReply(input: {
  businessId: string;
  threadId: string;
  contactId: string;
  messageId?: string | null;
  fromEmail: string;
  subject?: string | null;
  body: string;
  classification: ReplyClassification;
  providerReplyId?: string | null;
}): Promise<EmailReplyRow> {
  const result = await query<EmailReplyRow>(
    `INSERT INTO email_replies (business_id, thread_id, contact_id, message_id, from_email, subject, body, classification, provider_reply_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [input.businessId, input.threadId, input.contactId, input.messageId ?? null, input.fromEmail, input.subject ?? null, input.body, input.classification, input.providerReplyId ?? null]
  );
  return result.rows[0];
}

export async function listForBusiness(businessId: string, limit = 100): Promise<EmailReplyRow[]> {
  const result = await query<EmailReplyRow>(`SELECT * FROM email_replies WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`, [businessId, limit]);
  return result.rows;
}

export async function listForContact(businessId: string, contactId: string): Promise<EmailReplyRow[]> {
  const result = await query<EmailReplyRow>(`SELECT * FROM email_replies WHERE business_id = $1 AND contact_id = $2 ORDER BY created_at ASC`, [businessId, contactId]);
  return result.rows;
}

/** Marks every reply in a thread as read — called when the Inbox opens that conversation. Returns how many rows actually flipped (0 if already all read). */
export async function markThreadRead(businessId: string, threadId: string): Promise<number> {
  const result = await query(
    `UPDATE email_replies SET is_read = true WHERE business_id = $1 AND thread_id = $2 AND is_read = false`,
    [businessId, threadId]
  );
  return result.rowCount ?? 0;
}

export interface EmailReplyWithContext extends EmailReplyRow {
  contact_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
}

/** Backs the Gmail-style Inbox: every reply with its contact/lead context, scoped to the caller's own assigned leads when they're a sales user. */
export async function listForBusinessWithContext(
  businessId: string,
  opts: { limit?: number; restrictToUserId?: string } = {}
): Promise<EmailReplyWithContext[]> {
  const conditions = ['r.business_id = $1'];
  const values: unknown[] = [businessId];

  if (opts.restrictToUserId) {
    conditions.push(`l.assigned_user_id = $${values.length + 1}`);
    values.push(opts.restrictToUserId);
  }

  values.push(opts.limit ?? 200);

  const result = await query<EmailReplyWithContext>(
    `SELECT r.*, oc.contact_name, oc.lead_id, l.name AS lead_name
     FROM email_replies r
     JOIN outreach_contacts oc ON oc.id = r.contact_id
     LEFT JOIN leads l ON l.id = oc.lead_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY r.created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return result.rows;
}
