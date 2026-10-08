/**
 * Powers the Lead Details page's AI Email Composer and the automatic
 * 3/7/8/9-day follow-up queue, for a single CRM lead rather than a bulk
 * sheet-import campaign. Reuses the exact same outreach machinery as the
 * rest of the app (outreach_contacts, sequences, campaigns, drafts, the
 * approve-and-send path, reply detection) instead of inventing a parallel
 * system: every lead that gets emailed from its Lead Details page is simply
 * a one-contact campaign_contact in a single, per-business "Direct Lead
 * Follow-ups" campaign that stays in 'running' status forever (so approving
 * a draft sends it immediately, exactly like autoPilotService's campaigns).
 */
import * as outreachCampaignRepo from '../../repositories/outreachCampaignRepo';
import * as outreachSequenceRepo from '../../repositories/outreachSequenceRepo';
import * as outreachContactRepo from '../../repositories/outreachContactRepo';
import * as campaignContactRepo from '../../repositories/campaignContactRepo';
import * as outreachDraftRepo from '../../repositories/outreachDraftRepo';
import * as outreachMessageRepo from '../../repositories/outreachMessageRepo';
import { LeadRow } from '../../repositories/leadRepo';
import { normalizeEmail } from '../../utils/normalize';
import { BadRequestError } from '../../utils/appError';
import { generateDraftForStep } from './sequenceService';
import { OutreachCampaignRow } from '../../repositories/outreachCampaignRepo';
import { CampaignContactRow } from '../../repositories/campaignContactRepo';

const DIRECT_CAMPAIGN_NAME = 'Direct Lead Follow-ups (system)';
const DIRECT_SEQUENCE_NAME = 'Direct Lead Follow-ups';

// Cumulative day offsets from the initial send: 0 (initial), 3, 7, 14, 28.
// Stored as deltas from the *previous* step, matching how scheduleNextStep
// (sequenceService.ts) schedules next_send_at — Date.now() + delay_days at
// the moment the previous step was sent.
const DIRECT_SEQUENCE_STEPS: Array<{ stepOrder: number; delayDays: number; subjectTemplate: string }> = [
  { stepOrder: 1, delayDays: 0, subjectTemplate: 'Quick question for {{company}}' },
  { stepOrder: 2, delayDays: 3, subjectTemplate: 'Following up — {{company}}' },
  { stepOrder: 3, delayDays: 4, subjectTemplate: 'Still worth a conversation? — {{company}}' },
  { stepOrder: 4, delayDays: 7, subjectTemplate: 'One more try — {{company}}' },
  { stepOrder: 5, delayDays: 14, subjectTemplate: 'Closing the loop — {{company}}' },
];

/** The cumulative day offset (3, 7, 14, 28...) that step N (1-indexed) becomes due at, relative to the initial send. */
export function cumulativeDayOffsets(): number[] {
  let total = 0;
  return DIRECT_SEQUENCE_STEPS.map((s) => {
    total += s.delayDays;
    return total;
  });
}

export async function getOrCreateDirectCampaign(businessId: string, createdBy: string | null): Promise<OutreachCampaignRow> {
  const existing = (await outreachCampaignRepo.listCampaigns(businessId)).find(
    (c) => c.name === DIRECT_CAMPAIGN_NAME && c.status !== 'cancelled'
  );
  if (existing) {
    return existing.status === 'running' ? existing : ((await outreachCampaignRepo.setStatus(existing.id, businessId, 'running')) ?? existing);
  }

  const sequence = await outreachSequenceRepo.createSequence({
    businessId,
    name: DIRECT_SEQUENCE_NAME,
    description: 'System-managed sequence backing the Lead Details AI composer and the 3/7/8/9-day follow-up queue.',
  });
  await outreachSequenceRepo.replaceSteps(
    sequence.id,
    DIRECT_SEQUENCE_STEPS.map((s) => ({ ...s, aiPersonalize: true, isEnabled: true }))
  );

  const campaign = await outreachCampaignRepo.createCampaign({
    businessId,
    name: DIRECT_CAMPAIGN_NAME,
    description: 'System-managed — backs one-to-one emails sent from a Lead\'s own detail page, not a bulk import.',
    sequenceId: sequence.id,
    createdBy,
  });
  return (await outreachCampaignRepo.setStatus(campaign.id, businessId, 'running')) ?? campaign;
}

/** Finds or creates the outreach_contact for this lead's email address, linked back to the lead. */
export async function ensureContactForLead(businessId: string, lead: LeadRow) {
  if (!lead.email) throw new BadRequestError('This lead has no email address to send to');
  const normalizedEmail = normalizeEmail(lead.email);
  if (!normalizedEmail) throw new BadRequestError('This lead has no valid email address to send to');

  const { contact } = await outreachContactRepo.upsertContact({
    businessId,
    email: lead.email,
    normalizedEmail,
    companyName: lead.company,
    contactName: lead.name,
    industry: lead.industry,
    notes: lead.description,
    source: 'crm_lead',
  });

  if (!contact.lead_id) {
    await outreachContactRepo.linkToLead(contact.id, businessId, lead.id);
    contact.lead_id = lead.id;
  }

  return contact;
}

/**
 * Ensures the lead's contact is enrolled in the Direct campaign and returns
 * its campaign_contact row (creating it, and the campaign itself, on first
 * use for this lead).
 */
export async function ensureCampaignContactForLead(
  businessId: string,
  lead: LeadRow,
  actorUserId: string | null
): Promise<{ campaign: OutreachCampaignRow; campaignContact: CampaignContactRow }> {
  const contact = await ensureContactForLead(businessId, lead);
  const campaign = await getOrCreateDirectCampaign(businessId, actorUserId);
  const { row: campaignContact } = await campaignContactRepo.addContactToCampaign(businessId, campaign.id, contact.id);
  return { campaign, campaignContact };
}

/**
 * The AI Email Composer's entry point: ensures everything is wired up, then
 * returns the step-(current_step+1) draft for the employee to review/edit —
 * generating it on the fly if it doesn't exist yet. Never sends anything;
 * sending only happens when the employee approves the draft (existing
 * POST /api/outreach/drafts/:id/approve, which sends immediately since this
 * campaign is always 'running').
 */
export async function getOrGenerateComposerDraft(businessId: string, lead: LeadRow, actorUserId: string | null) {
  const { campaignContact } = await ensureCampaignContactForLead(businessId, lead, actorUserId);

  // The contact may already have received a first email through another
  // campaign (for example a sheet import). Starting this lead's sequence from
  // step 1 would send that first-contact email a second time.
  if (campaignContact.current_step === 0 && (await outreachMessageRepo.countSentForContact(businessId, campaignContact.contact_id)) > 0) {
    throw new BadRequestError('This contact was already emailed through another campaign, so a first-contact email cannot be sent again');
  }

  const existingDrafts = await outreachDraftRepo.listForCampaignContact(campaignContact.id);
  const currentStepDraft = existingDrafts.find((d) => d.step_order === campaignContact.current_step + 1 && d.status === 'draft');
  if (currentStepDraft) return { draft: currentStepDraft, campaignContact };

  if (campaignContact.current_step >= DIRECT_SEQUENCE_STEPS.length) {
    throw new BadRequestError('This lead has already completed the full follow-up sequence');
  }
  if (!['pending', 'drafted'].includes(campaignContact.status)) {
    throw new BadRequestError('This lead already has a message awaiting send — check Sent or the Follow-ups queue');
  }

  const draft = await generateDraftForStep(campaignContact);
  return { draft, campaignContact };
}
