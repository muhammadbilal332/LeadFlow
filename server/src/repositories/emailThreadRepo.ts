import { query } from '../db/pool';

export interface EmailThreadRow {
  id: string;
  business_id: string;
  campaign_id: string | null;
  contact_id: string;
  provider_thread_id: string | null;
  subject: string | null;
  created_at: string;
  updated_at: string;
}

export async function findByContactAndCampaign(businessId: string, contactId: string, campaignId: string): Promise<EmailThreadRow | null> {
  const result = await query<EmailThreadRow>(
    `SELECT * FROM email_threads WHERE business_id = $1 AND contact_id = $2 AND campaign_id = $3`,
    [businessId, contactId, campaignId]
  );
  return result.rows[0] ?? null;
}

export async function findByContact(businessId: string, contactId: string): Promise<EmailThreadRow[]> {
  const result = await query<EmailThreadRow>(`SELECT * FROM email_threads WHERE business_id = $1 AND contact_id = $2 ORDER BY created_at DESC`, [businessId, contactId]);
  return result.rows;
}

export async function findOrCreate(input: { businessId: string; campaignId: string; contactId: string; subject: string }): Promise<EmailThreadRow> {
  const existing = await findByContactAndCampaign(input.businessId, input.contactId, input.campaignId);
  if (existing) return existing;

  const result = await query<EmailThreadRow>(
    `INSERT INTO email_threads (business_id, campaign_id, contact_id, subject) VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.businessId, input.campaignId, input.contactId, input.subject]
  );
  return result.rows[0];
}

export async function setProviderThreadId(id: string, providerThreadId: string): Promise<void> {
  await query(`UPDATE email_threads SET provider_thread_id = $1, updated_at = now() WHERE id = $2`, [providerThreadId, id]);
}

export async function findById(id: string, businessId: string): Promise<EmailThreadRow | null> {
  const result = await query<EmailThreadRow>(`SELECT * FROM email_threads WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}
