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
