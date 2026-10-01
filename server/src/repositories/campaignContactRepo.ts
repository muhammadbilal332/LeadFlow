import { query } from '../db/pool';

export type CampaignContactStatus = 'pending' | 'drafted' | 'approved' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'replied' | 'unsubscribed' | 'stopped' | 'failed';

export interface CampaignContactRow {
  id: string;
  business_id: string;
  campaign_id: string;
  contact_id: string;
  status: CampaignContactStatus;
  current_step: number;
  next_send_at: string | null;
  stopped_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function addContactToCampaign(businessId: string, campaignId: string, contactId: string): Promise<{ row: CampaignContactRow; created: boolean }> {
  const existing = await query<CampaignContactRow>(
    `SELECT * FROM outreach_campaign_contacts WHERE campaign_id = $1 AND contact_id = $2`,
    [campaignId, contactId]
  );
  if (existing.rows[0]) return { row: existing.rows[0], created: false };

  const result = await query<CampaignContactRow>(
    `INSERT INTO outreach_campaign_contacts (business_id, campaign_id, contact_id, next_send_at) VALUES ($1,$2,$3,now()) RETURNING *`,
    [businessId, campaignId, contactId]
  );
  return { row: result.rows[0], created: true };
}

export async function listForCampaign(campaignId: string, businessId: string): Promise<CampaignContactRow[]> {
  const result = await query<CampaignContactRow>(
    `SELECT * FROM outreach_campaign_contacts WHERE campaign_id = $1 AND business_id = $2 ORDER BY created_at ASC`,
    [campaignId, businessId]
  );
  return result.rows;
}

export interface CampaignContactWithFailureReason extends CampaignContactRow {
  failed_reason: string | null;
}

/**
 * Same as listForCampaign, but a 'failed' contact also carries the actual
 * provider error (e.g. a Resend rejection) from its most recent failed
 * send — so the campaign page can show *why* a send failed instead of just
 * that it did. Two flat queries merged in JS rather than a join with a
 * correlated subquery, since pg-mem (the test harness) doesn't support
 * those in a SELECT list; a plain JOIN works in both.
 */
export async function listForCampaignWithFailureReason(campaignId: string, businessId: string): Promise<CampaignContactWithFailureReason[]> {
  const [contacts, failures] = await Promise.all([
    listForCampaign(campaignId, businessId),
    query<{ campaign_contact_id: string; failed_reason: string | null }>(
      `SELECT m.campaign_contact_id, m.failed_reason
       FROM outreach_messages m
       JOIN outreach_campaign_contacts cc ON cc.id = m.campaign_contact_id
       WHERE m.business_id = $1 AND cc.campaign_id = $2 AND m.status = 'failed'
       ORDER BY m.created_at ASC`,
      [businessId, campaignId]
    ),
  ]);

  const reasonByContact = new Map<string, string | null>();
  for (const row of failures.rows) reasonByContact.set(row.campaign_contact_id, row.failed_reason);

  return contacts.map((c) => ({ ...c, failed_reason: reasonByContact.get(c.id) ?? null }));
}

export async function findById(id: string, businessId: string): Promise<CampaignContactRow | null> {
  const result = await query<CampaignContactRow>(`SELECT * FROM outreach_campaign_contacts WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function findByContactId(businessId: string, contactId: string): Promise<CampaignContactRow[]> {
  const result = await query<CampaignContactRow>(`SELECT * FROM outreach_campaign_contacts WHERE business_id = $1 AND contact_id = $2`, [businessId, contactId]);
  return result.rows;
}

export async function setStatus(id: string, status: CampaignContactStatus, opts: { stoppedReason?: string | null } = {}): Promise<void> {
  await query(
    `UPDATE outreach_campaign_contacts SET status = $1, stopped_reason = COALESCE($2, stopped_reason), updated_at = now() WHERE id = $3`,
    [status, opts.stoppedReason ?? null, id]
  );
}

export async function advanceStep(id: string, nextStep: number, nextSendAt: string | null): Promise<void> {
  await query(
    `UPDATE outreach_campaign_contacts SET current_step = $1, next_send_at = $2, updated_at = now() WHERE id = $3`,
    [nextStep, nextSendAt, id]
  );
}

/**
 * Campaign contacts awaiting their next step's draft to be generated — the
 * step's scheduled time has arrived but no draft exists yet. Compares
 * against the database's own `now()` rather than an app-server timestamp:
 * comparing a DB-written `next_send_at` (set via SQL `now()`) against a
 * JS-computed `Date.now()` is fragile under any clock skew between the app
 * host and a remote database (e.g. Supabase) — a contact inserted a moment
 * ago could otherwise be invisible to this query if the app clock lags the
 * database clock even slightly.
 */
export async function findPendingDraftGeneration(businessId: string): Promise<CampaignContactRow[]> {
  const result = await query<CampaignContactRow>(
    `SELECT cc.* FROM outreach_campaign_contacts cc
     JOIN outreach_campaigns c ON c.id = cc.campaign_id
     WHERE cc.business_id = $1 AND c.status NOT IN ('cancelled', 'completed', 'paused')
       AND cc.status = 'pending'
       AND cc.next_send_at IS NOT NULL AND cc.next_send_at <= now()
     ORDER BY cc.next_send_at ASC
     LIMIT 100`,
    [businessId]
  );
  return result.rows;
}

/** Campaign contacts whose current-step draft has been approved by a human and is ready to send. */
export async function findApprovedReadyToSend(businessId: string): Promise<CampaignContactRow[]> {
  const result = await query<CampaignContactRow>(
    `SELECT cc.* FROM outreach_campaign_contacts cc
     JOIN outreach_campaigns c ON c.id = cc.campaign_id
     WHERE cc.business_id = $1 AND c.status = 'running' AND cc.status = 'approved'
     ORDER BY cc.updated_at ASC
     LIMIT 100`,
    [businessId]
  );
  return result.rows;
}

/** Stops every active campaign_contact row for a contact (e.g. on reply, unsubscribe, bounce, suppression). */
export async function stopAllForContact(businessId: string, contactId: string, reason: string): Promise<number> {
  const result = await query(
    `UPDATE outreach_campaign_contacts SET status = 'stopped', stopped_reason = $1, next_send_at = NULL, updated_at = now()
     WHERE business_id = $2 AND contact_id = $3 AND status NOT IN ('stopped', 'unsubscribed', 'bounced')`,
    [reason, businessId, contactId]
  );
  return result.rowCount ?? 0;
}

export async function countByCampaignAndStatus(campaignId: string): Promise<Record<string, number>> {
  const result = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text as count FROM outreach_campaign_contacts WHERE campaign_id = $1 GROUP BY status`,
    [campaignId]
  );
  const counts: Record<string, number> = {};
  for (const row of result.rows) counts[row.status] = Number(row.count);
  return counts;
}
