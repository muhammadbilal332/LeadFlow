/**
 * The Follow-Ups page's "morning work queue": every lead-linked
 * campaign_contact sitting on a due (or soon-due) follow-up step —
 * 3/7/14/28-day, computed from the actual cumulative delay of the Direct
 * sequence's steps, never hardcoded per-lead dates — bucketed for display.
 * A contact stops appearing the moment it's sent, stopped (reply detected),
 * suppressed, or its campaign is cancelled/completed, since all of those
 * already flip its status/campaign away from what this query selects.
 */
import { query } from '../../db/pool';
import * as outreachSequenceRepo from '../../repositories/outreachSequenceRepo';
import * as campaignContactRepo from '../../repositories/campaignContactRepo';
import * as outreachMessageRepo from '../../repositories/outreachMessageRepo';
import { cumulativeDayOffsets } from './directLeadOutreachService';

function labelForOffset(offset: number | null): string {
  if (offset === 3) return '3-Day Follow-Up';
  if (offset === 7) return '7-Day Follow-Up';
  if (offset === 14) return '14-Day Follow-Up';
  if (offset === 28) return '28-Day Follow-Up';
  return 'Follow-Up';
}

/**
 * The single-lead version of the queue logic above — drives the "Follow-Up
 * status" shown on a Lead's own detail page. Always derived from the real
 * campaign_contact/outreach_message state for this lead's linked contact,
 * never a hardcoded string.
 */
export async function getFollowUpStatusForLead(
  businessId: string,
  contactId: string | null
): Promise<{ label: string; state: 'none' | 'not_sent' | 'pending' | 'overdue' | 'sent' | 'stopped' | 'completed'; dueAt: string | null }> {
  if (!contactId) return { label: 'No outreach contact linked yet', state: 'none', dueAt: null };

  const ccs = await campaignContactRepo.findByContactId(businessId, contactId);
  if (ccs.length === 0) return { label: 'No outreach sent yet', state: 'none', dueAt: null };

  // Most recently touched enrollment — in practice a lead has exactly one
  // (the Direct campaign), but a contact that also belongs to a bulk
  // campaign could have more; the newest one reflects current reality.
  const cc = ccs.slice().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];

  if (cc.status === 'stopped' || cc.status === 'unsubscribed' || cc.status === 'bounced') {
    return { label: `Follow-ups stopped (${cc.stopped_reason || cc.status})`, state: 'stopped', dueAt: null };
  }

  if (cc.current_step === 0 && ['pending', 'drafted', 'approved'].includes(cc.status)) {
    return { label: 'Initial email not yet sent', state: 'not_sent', dueAt: null };
  }

  if (['pending', 'drafted', 'approved'].includes(cc.status) && cc.next_send_at) {
    const offsets = cumulativeDayOffsets();
    const targetOffset = offsets[cc.current_step] ?? null; // next_step_order - 1 index
    const daysPastDue = Math.floor((Date.now() - new Date(cc.next_send_at).getTime()) / 86_400_000);
    if (daysPastDue > 1) {
      return { label: 'Overdue', state: 'overdue', dueAt: cc.next_send_at };
    }
    if (daysPastDue >= 0) {
      return { label: `Pending ${labelForOffset(targetOffset)}`, state: 'pending', dueAt: cc.next_send_at };
    }
    return { label: `Pending ${labelForOffset(targetOffset)}`, state: 'pending', dueAt: cc.next_send_at };
  }

  if (cc.status === 'sent' && !cc.next_send_at) {
    const messages = await outreachMessageRepo.listForCampaignContact(cc.id);
    const last = messages[messages.length - 1];
    if (last) {
      const offsets = cumulativeDayOffsets();
      const label = labelForOffset(offsets[lastStepOrderIndex(cc.current_step)] ?? null);
      return { label: `${cc.current_step <= 1 ? 'Initial email' : label} sent ${new Date(last.sent_at ?? last.created_at).toLocaleDateString()}`, state: 'sent', dueAt: null };
    }
    return { label: 'Follow-up sequence complete', state: 'completed', dueAt: null };
  }

  return { label: 'Follow-up sequence complete', state: 'completed', dueAt: null };
}

function lastStepOrderIndex(currentStep: number): number {
  return Math.max(0, currentStep - 1);
}

export type FollowUpBucket = '3-day' | '7-day' | '14-day' | '28-day' | 'overdue';

export interface FollowUpQueueItem {
  campaign_contact_id: string;
  campaign_id: string;
  contact_id: string;
  lead_id: string;
  lead_name: string;
  company: string | null;
  lead_status: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  current_step: number;
  next_step_order: number;
  next_send_at: string;
  cc_status: string;
  has_draft: boolean;
  days_past_due: number;
  bucket: FollowUpBucket;
}

interface RawRow {
  cc_id: string;
  campaign_id: string;
  contact_id: string;
  lead_id: string;
  lead_name: string;
  company: string | null;
  lead_status: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  current_step: number;
  next_send_at: string;
  cc_status: string;
  sequence_id: string | null;
}

export async function listFollowUpQueue(businessId: string, restrictToUserId?: string): Promise<FollowUpQueueItem[]> {
  const conditions = [
    'cc.business_id = $1',
    'oc.lead_id IS NOT NULL',
    "cc.current_step >= 1",
    "cc.status IN ('pending', 'drafted')",
    "c.status NOT IN ('cancelled', 'completed')",
    'cc.next_send_at IS NOT NULL',
    "cc.next_send_at <= now() + interval '1 day'",
  ];
  const values: unknown[] = [businessId];

  if (restrictToUserId) {
    conditions.push(`l.assigned_user_id = $${values.length + 1}`);
    values.push(restrictToUserId);
  }

  // A correlated EXISTS subquery in the SELECT list referencing the outer
  // query's alias is not supported by pg-mem (the test harness) even though
  // real Postgres handles it fine — same limitation already worked around
  // elsewhere in this codebase (see campaignContactRepo.ts). Fetched as two
  // flat queries and merged in JS instead.
  const result = await query<RawRow>(
    `SELECT cc.id AS cc_id, cc.campaign_id, cc.contact_id, cc.current_step, cc.next_send_at, cc.status AS cc_status,
            oc.lead_id, l.name AS lead_name, l.company, l.status AS lead_status, l.assigned_user_id,
            u.name AS assigned_user_name, c.sequence_id
     FROM outreach_campaign_contacts cc
     JOIN outreach_contacts oc ON oc.id = cc.contact_id
     JOIN leads l ON l.id = oc.lead_id
     JOIN outreach_campaigns c ON c.id = cc.campaign_id
     LEFT JOIN users u ON u.id = l.assigned_user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY cc.next_send_at ASC`,
    values
  );

  const draftedContactIds = new Set<string>();
  if (result.rows.length > 0) {
    const placeholders = result.rows.map((_, i) => `$${i + 1}`).join(', ');
    const draftRows = await query<{ campaign_contact_id: string }>(
      `SELECT DISTINCT campaign_contact_id FROM outreach_drafts WHERE status = 'draft' AND campaign_contact_id IN (${placeholders})`,
      result.rows.map((r) => r.cc_id)
    );
    for (const row of draftRows.rows) draftedContactIds.add(row.campaign_contact_id);
  }

  const stepsBySequence = new Map<string, number[]>();
  async function offsetsFor(sequenceId: string | null): Promise<number[]> {
    if (!sequenceId) return cumulativeDayOffsets();
    if (stepsBySequence.has(sequenceId)) return stepsBySequence.get(sequenceId)!;
    const steps = await outreachSequenceRepo.listSteps(sequenceId);
    let total = 0;
    const offsets = steps
      .sort((a, b) => a.step_order - b.step_order)
      .map((s) => {
        total += s.delay_days;
        return total;
      });
    stepsBySequence.set(sequenceId, offsets);
    return offsets;
  }

  const items: FollowUpQueueItem[] = [];
  const now = Date.now();

  for (const row of result.rows) {
    const offsets = await offsetsFor(row.sequence_id);
    const nextStepOrder = row.current_step + 1;
    const targetOffset = offsets[nextStepOrder - 1] ?? null;
    const daysPastDue = Math.floor((now - new Date(row.next_send_at).getTime()) / 86_400_000);

    let bucket: FollowUpBucket;
    if (daysPastDue > 1) {
      bucket = 'overdue';
    } else if (targetOffset === 3) {
      bucket = '3-day';
    } else if (targetOffset === 7) {
      bucket = '7-day';
    } else if (targetOffset === 14) {
      bucket = '14-day';
    } else if (targetOffset === 28) {
      bucket = '28-day';
    } else {
      // A custom sequence step that doesn't land on 3/7/14/28 still needs a
      // home in the queue rather than being silently dropped.
      bucket = 'overdue';
    }

    items.push({
      campaign_contact_id: row.cc_id,
      campaign_id: row.campaign_id,
      contact_id: row.contact_id,
      lead_id: row.lead_id,
      lead_name: row.lead_name,
      company: row.company,
      lead_status: row.lead_status,
      assigned_user_id: row.assigned_user_id,
      assigned_user_name: row.assigned_user_name,
      current_step: row.current_step,
      next_step_order: nextStepOrder,
      next_send_at: row.next_send_at,
      cc_status: row.cc_status,
      has_draft: draftedContactIds.has(row.cc_id),
      days_past_due: daysPastDue,
      bucket,
    });
  }

  return items;
}
