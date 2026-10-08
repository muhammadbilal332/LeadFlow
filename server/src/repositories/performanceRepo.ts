import { query } from '../db/pool';

/**
 * Who did what is recorded as follows, so every per-person number is scoped
 * to the same period start (`since`):
 * - Emails sent: the draft's approver (outreach_drafts.approved_by).
 * - Replies: the thread's outgoing messages point back to that same approver.
 * - New leads: leads created in the period, counted against the assignee.
 * - Won / Lost: "Status changed" activities logged in the period, counted
 *   against the user who made the change.
 */

export interface PersonActivity {
  userId: string;
  emailsSent: number;
  repliesReceived: number;
  newLeads: number;
  won: number;
  lost: number;
}

function emptyActivity(userId: string): PersonActivity {
  return { userId, emailsSent: 0, repliesReceived: 0, newLeads: 0, won: 0, lost: 0 };
}

export async function activityByUser(businessId: string, since: string): Promise<PersonActivity[]> {
  const byUser = new Map<string, PersonActivity>();
  const entry = (userId: string) => {
    let row = byUser.get(userId);
    if (!row) {
      row = emptyActivity(userId);
      byUser.set(userId, row);
    }
    return row;
  };

  const sent = await query<{ user_id: string; count: string }>(
    `SELECT d.approved_by AS user_id, COUNT(m.id)::text AS count
     FROM outreach_messages m
     JOIN outreach_drafts d ON d.id = m.draft_id
     WHERE m.business_id = $1 AND m.sent_at IS NOT NULL AND d.approved_by IS NOT NULL
       AND m.sent_at >= $2::timestamptz
     GROUP BY d.approved_by`,
    [businessId, since]
  );
  for (const r of sent.rows) entry(r.user_id).emailsSent = Number(r.count);

  const replies = await query<{ user_id: string; count: string }>(
    `SELECT d.approved_by AS user_id, COUNT(DISTINCT r.id)::text AS count
     FROM email_replies r
     JOIN outreach_messages m ON m.thread_id = r.thread_id
     JOIN outreach_drafts d ON d.id = m.draft_id
     WHERE r.business_id = $1 AND d.approved_by IS NOT NULL
       AND r.created_at >= $2::timestamptz
     GROUP BY d.approved_by`,
    [businessId, since]
  );
  for (const r of replies.rows) entry(r.user_id).repliesReceived = Number(r.count);

  const created = await query<{ user_id: string; count: string }>(
    `SELECT assigned_user_id AS user_id, COUNT(*)::text AS count
     FROM leads
     WHERE business_id = $1 AND assigned_user_id IS NOT NULL AND duplicate_of_lead_id IS NULL
       AND created_at >= $2::timestamptz
     GROUP BY assigned_user_id`,
    [businessId, since]
  );
  for (const r of created.rows) entry(r.user_id).newLeads = Number(r.count);

  const outcomes = await query<{ user_id: string; description: string }>(
    `SELECT user_id, description FROM activities
     WHERE business_id = $1 AND type = 'Status changed' AND user_id IS NOT NULL
       AND created_at >= $2::timestamptz
       AND (description LIKE '% to Won.' OR description LIKE '% to Lost.')`,
    [businessId, since]
  );
  for (const r of outcomes.rows) {
    if (r.description.endsWith('to Won.')) entry(r.user_id).won += 1;
    else entry(r.user_id).lost += 1;
  }

  return [...byUser.values()];
}

export interface PersonRow {
  id: string;
  name: string;
  role: string;
}

export async function findPerson(businessId: string, userId: string): Promise<PersonRow | null> {
  const result = await query<PersonRow>(`SELECT id, name, role FROM users WHERE id = $1 AND business_id = $2`, [userId, businessId]);
  return result.rows[0] ?? null;
}

export interface PersonEmailRow {
  id: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  failed_reason: string | null;
  thread_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  lead_id: string | null;
}

const PERSON_EMAIL_SELECT = `SELECT m.id, m.subject, m.body, m.status, m.sent_at, m.failed_reason, m.thread_id,
          oc.email AS recipient_email, oc.contact_name AS recipient_name, oc.lead_id
   FROM outreach_messages m
   JOIN outreach_drafts d ON d.id = m.draft_id
   JOIN outreach_campaign_contacts cc ON cc.id = m.campaign_contact_id
   JOIN outreach_contacts oc ON oc.id = cc.contact_id`;

/** Emails this person sent since the period start, newest first. */
export async function listEmailsSentBy(businessId: string, userId: string, since: string): Promise<PersonEmailRow[]> {
  const result = await query<PersonEmailRow>(
    `${PERSON_EMAIL_SELECT}
     WHERE m.business_id = $1 AND d.approved_by = $2 AND m.sent_at IS NOT NULL
       AND m.sent_at >= $3::timestamptz
     ORDER BY m.sent_at DESC`,
    [businessId, userId, since]
  );
  return result.rows;
}

/** One email this person sent, or null if it was not theirs. */
export async function findEmailSentBy(businessId: string, userId: string, messageId: string): Promise<PersonEmailRow | null> {
  const result = await query<PersonEmailRow>(
    `${PERSON_EMAIL_SELECT}
     WHERE m.business_id = $1 AND d.approved_by = $2 AND m.id = $3`,
    [businessId, userId, messageId]
  );
  return result.rows[0] ?? null;
}

export interface ReplyRow {
  id: string;
  from_email: string;
  subject: string | null;
  body: string;
  classification: string;
  created_at: string;
}

export async function listRepliesForThread(businessId: string, threadId: string | null): Promise<ReplyRow[]> {
  if (!threadId) return [];
  const result = await query<ReplyRow>(
    `SELECT id, from_email, subject, body, classification, created_at
     FROM email_replies
     WHERE business_id = $1 AND thread_id = $2
     ORDER BY created_at ASC`,
    [businessId, threadId]
  );
  return result.rows;
}

/** Reply counts per thread for the whole business, used to annotate a person's email list. */
export async function replyCountsByThread(businessId: string): Promise<Map<string, number>> {
  const result = await query<{ thread_id: string; count: string }>(
    `SELECT thread_id, COUNT(*)::text AS count FROM email_replies WHERE business_id = $1 GROUP BY thread_id`,
    [businessId]
  );
  return new Map(result.rows.map((r) => [r.thread_id, Number(r.count)]));
}
