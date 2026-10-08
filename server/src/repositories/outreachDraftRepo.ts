import { query } from '../db/pool';

export type QualityStatus = 'passed' | 'warnings' | 'blocked';
export type DraftStatus = 'draft' | 'approved' | 'rejected' | 'sent';

export interface QualityIssue {
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
}

export interface OutreachDraftRow {
  id: string;
  business_id: string;
  campaign_contact_id: string;
  step_order: number;
  subject: string;
  ai_raw_body: string;
  naturalized_body: string;
  final_body: string | null;
  quality_status: QualityStatus;
  quality_issues: QualityIssue[];
  status: DraftStatus;
  scheduled_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createDraft(input: {
  businessId: string;
  campaignContactId: string;
  stepOrder: number;
  subject: string;
  aiRawBody: string;
  naturalizedBody: string;
  qualityStatus: QualityStatus;
  qualityIssues: QualityIssue[];
}): Promise<OutreachDraftRow> {
  const result = await query<OutreachDraftRow>(
    `INSERT INTO outreach_drafts (business_id, campaign_contact_id, step_order, subject, ai_raw_body, naturalized_body, final_body, quality_status, quality_issues)
     VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8) RETURNING *`,
    [input.businessId, input.campaignContactId, input.stepOrder, input.subject, input.aiRawBody, input.naturalizedBody, input.qualityStatus, JSON.stringify(input.qualityIssues)]
  );
  return result.rows[0];
}

export async function findById(id: string, businessId: string): Promise<OutreachDraftRow | null> {
  const result = await query<OutreachDraftRow>(`SELECT * FROM outreach_drafts WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function listForCampaignContact(campaignContactId: string): Promise<OutreachDraftRow[]> {
  const result = await query<OutreachDraftRow>(`SELECT * FROM outreach_drafts WHERE campaign_contact_id = $1 ORDER BY step_order ASC`, [campaignContactId]);
  return result.rows;
}

/** A draft plus who it is addressed to, so the review screen shows the recipient's name, email and company. */
export interface OutreachDraftWithRecipient extends OutreachDraftRow {
  recipient_name: string | null;
  recipient_email: string;
  company_name: string | null;
  lead_id: string | null;
}

export async function listPendingReview(businessId: string, campaignId?: string): Promise<OutreachDraftWithRecipient[]> {
  const select = `SELECT d.*, oc.contact_name AS recipient_name, oc.email AS recipient_email, oc.company_name, oc.lead_id
     FROM outreach_drafts d
     JOIN outreach_campaign_contacts cc ON cc.id = d.campaign_contact_id
     JOIN outreach_contacts oc ON oc.id = cc.contact_id`;
  if (campaignId) {
    const result = await query<OutreachDraftWithRecipient>(
      `${select} WHERE d.business_id = $1 AND d.status = 'draft' AND cc.campaign_id = $2 ORDER BY d.created_at ASC`,
      [businessId, campaignId]
    );
    return result.rows;
  }
  const result = await query<OutreachDraftWithRecipient>(`${select} WHERE d.business_id = $1 AND d.status = 'draft' ORDER BY d.created_at ASC`, [businessId]);
  return result.rows;
}

export async function updateContent(id: string, businessId: string, input: { subject?: string; finalBody?: string }): Promise<OutreachDraftRow | null> {
  const result = await query<OutreachDraftRow>(
    `UPDATE outreach_drafts SET subject = COALESCE($1, subject), final_body = COALESCE($2, final_body), updated_at = now()
     WHERE id = $3 AND business_id = $4 RETURNING *`,
    [input.subject ?? null, input.finalBody ?? null, id, businessId]
  );
  return result.rows[0] ?? null;
}

export async function setStatus(id: string, businessId: string, status: DraftStatus, opts: { approvedBy?: string } = {}): Promise<OutreachDraftRow | null> {
  const result = await query<OutreachDraftRow>(
    `UPDATE outreach_drafts SET status = $1,
       approved_by = CASE WHEN $1 = 'approved' THEN $2 ELSE approved_by END,
       approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END,
       updated_at = now()
     WHERE id = $3 AND business_id = $4 RETURNING *`,
    [status, opts.approvedBy ?? null, id, businessId]
  );
  return result.rows[0] ?? null;
}
