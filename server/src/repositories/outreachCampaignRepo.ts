import { query } from '../db/pool';

export type CampaignStatus = 'draft' | 'review' | 'approved' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface OutreachCampaignRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  sender_name: string | null;
  sender_email: string | null;
  reply_to: string | null;
  sequence_id: string | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCampaigns(businessId: string): Promise<OutreachCampaignRow[]> {
  const result = await query<OutreachCampaignRow>(`SELECT * FROM outreach_campaigns WHERE business_id = $1 ORDER BY created_at DESC`, [businessId]);
  return result.rows;
}

export async function findCampaignById(id: string, businessId: string): Promise<OutreachCampaignRow | null> {
  const result = await query<OutreachCampaignRow>(`SELECT * FROM outreach_campaigns WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function createCampaign(input: {
  businessId: string;
  name: string;
  description?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  replyTo?: string | null;
  sequenceId?: string | null;
  createdBy?: string | null;
}): Promise<OutreachCampaignRow> {
  const result = await query<OutreachCampaignRow>(
    `INSERT INTO outreach_campaigns (business_id, name, description, sender_name, sender_email, reply_to, sequence_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [input.businessId, input.name, input.description ?? null, input.senderName ?? null, input.senderEmail ?? null, input.replyTo ?? null, input.sequenceId ?? null, input.createdBy ?? null]
  );
  return result.rows[0];
}

export async function updateCampaign(
  id: string,
  businessId: string,
  input: { name?: string; description?: string | null; senderName?: string | null; senderEmail?: string | null; replyTo?: string | null; sequenceId?: string | null }
): Promise<OutreachCampaignRow | null> {
  const result = await query<OutreachCampaignRow>(
    `UPDATE outreach_campaigns SET
       name = COALESCE($1, name), description = COALESCE($2, description),
       sender_name = COALESCE($3, sender_name), sender_email = COALESCE($4, sender_email),
       reply_to = COALESCE($5, reply_to), sequence_id = COALESCE($6, sequence_id), updated_at = now()
     WHERE id = $7 AND business_id = $8 RETURNING *`,
    [input.name ?? null, input.description ?? null, input.senderName ?? null, input.senderEmail ?? null, input.replyTo ?? null, input.sequenceId ?? null, id, businessId]
  );
  return result.rows[0] ?? null;
}

export async function setStatus(id: string, businessId: string, status: CampaignStatus): Promise<OutreachCampaignRow | null> {
  const result = await query<OutreachCampaignRow>(
    `UPDATE outreach_campaigns SET status = $1, updated_at = now() WHERE id = $2 AND business_id = $3 RETURNING *`,
    [status, id, businessId]
  );
  return result.rows[0] ?? null;
}

export async function approve(id: string, businessId: string, approvedBy: string): Promise<OutreachCampaignRow | null> {
  const result = await query<OutreachCampaignRow>(
    `UPDATE outreach_campaigns SET status = 'approved', approved_by = $1, approved_at = now(), updated_at = now()
     WHERE id = $2 AND business_id = $3 RETURNING *`,
    [approvedBy, id, businessId]
  );
  return result.rows[0] ?? null;
}

/** Cascades to its campaign_contacts, drafts, messages, and events (ON DELETE CASCADE in the schema). */
export async function deleteCampaign(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM outreach_campaigns WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}
