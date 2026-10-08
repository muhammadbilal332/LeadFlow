/**
 * Central Lead Intake Service.
 *
 * Every way a lead can enter LeadFlow — a public capture form, a Meta
 * lead-ad webhook, a generic n8n/API webhook, manual creation in the CRM,
 * or CSV import — funnels through `intakeLead()`. This is the one place
 * that normalizes input, checks for duplicates, scores the lead, assigns
 * it, schedules its first follow-up per the business's SLA targets, and
 * runs automation rules. No intake path re-implements this pipeline.
 */
import * as leadRepo from '../repositories/leadRepo';
import * as activityRepo from '../repositories/activityRepo';
import * as followUpRepo from '../repositories/followUpRepo';
import { calculateLeadScore, priorityFromScore } from './scoringService';
import { normalizeEmail, normalizePhone } from '../utils/normalize';
import { resolveAssignment } from './routingService';
import { getSlaSettings } from '../repositories/routingRuleRepo';
import { runAutomationRules } from './automationService';
import { notifyUser, notifyOwner } from './notificationService';
import { LeadRow } from '../repositories/leadRepo';

const VALID_SOURCES = new Set([
  'Website', 'WhatsApp', 'Facebook', 'Instagram', 'Phone', 'Referral', 'Other',
  'GoogleAds', 'Manual', 'CSV', 'API', 'Form', 'GoogleSheet',
]);

const SOURCE_ALIASES: Record<string, string> = {
  website: 'Website', whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram',
  phone: 'Phone', referral: 'Referral', other: 'Other', googleads: 'GoogleAds',
  google_ads: 'GoogleAds', 'google ads': 'GoogleAds', manual: 'Manual', csv: 'CSV',
  api: 'API', form: 'Form', googlesheet: 'GoogleSheet', 'google_sheet': 'GoogleSheet', 'google sheet': 'GoogleSheet',
};

/** External sources (webhooks, integrations) may send free-text/lowercase source values; map them onto the app's canonical, DB-constrained set. Unrecognized values fall back to "Other" rather than being rejected. */
function normalizeSource(source: string): string {
  if (VALID_SOURCES.has(source)) return source;
  return SOURCE_ALIASES[source.trim().toLowerCase()] ?? 'Other';
}

export interface LeadIntakeInput {
  businessId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  source: string;
  sourceDetail?: string | null;
  industry?: string | null;
  interestedIn?: string | null;
  timeline?: string | null;
  description?: string | null;
  /** Explicit assignment (e.g. a sales user creating their own lead, or an owner picking someone). Bypasses routing rules. */
  assignedUserId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  campaign?: string | null;
  adSet?: string | null;
  ad?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  formId?: string | null;
  /** 'meta' | 'n8n' | 'webhook' | 'form' | 'manual' | 'csv' | 'api' */
  externalSource?: string | null;
  /** Idempotency key for redeliverable sources (e.g. a Meta leadgen_id). */
  externalId?: string | null;
  /** Authenticated user who triggered this (owner/sales creating manually). Null for public/webhook intake. */
  actorUserId?: string | null;
  /** Skip assignment/follow-up/automation side effects (used for CSV bulk import to avoid a notification storm). */
  skipAutomation?: boolean;
}

export interface LeadIntakeResult {
  lead: LeadRow;
  /** False only when an idempotent webhook redelivery matched an already-created lead. */
  created: boolean;
  isDuplicate: boolean;
  duplicateOfLeadId?: string;
}

export async function intakeLead(rawInput: LeadIntakeInput): Promise<LeadIntakeResult> {
  const input: LeadIntakeInput = { ...rawInput, source: normalizeSource(rawInput.source) };

  if (input.externalSource && input.externalId) {
    const existing = await leadRepo.findLeadByExternalId(input.businessId, input.externalSource, input.externalId);
    if (existing) {
      return {
        lead: existing,
        created: false,
        isDuplicate: Boolean(existing.duplicate_of_lead_id),
        duplicateOfLeadId: existing.duplicate_of_lead_id ?? undefined,
      };
    }
  }

  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);

  // One lead per email address: a new submission with an email we already
  // have is merged into that lead (filling any blanks) instead of creating a
  // second lead that could be contacted again.
  const emailMatch = await leadRepo.findPotentialDuplicate(input.businessId, normalizedEmail, null);
  if (emailMatch) {
    const patch: leadRepo.UpdateLeadInput = {};
    if (!emailMatch.company && input.company) patch.company = input.company;
    if (!emailMatch.phone && input.phone) patch.phone = input.phone;
    if (!emailMatch.industry && input.industry) patch.industry = input.industry;
    const master = (Object.keys(patch).length > 0 ? await leadRepo.updateLead(emailMatch.id, input.businessId, patch) : null) ?? emailMatch;
    await activityRepo.createActivity({
      businessId: input.businessId,
      leadId: master.id,
      userId: input.actorUserId ?? null,
      type: 'Duplicate merged',
      description: `A new submission with this email (${input.source}) was merged into this lead instead of creating a duplicate.`,
    });
    return { lead: master, created: false, isDuplicate: true, duplicateOfLeadId: master.id };
  }

  const potentialDuplicate = await leadRepo.findPotentialDuplicate(input.businessId, null, normalizedPhone);

  const score = calculateLeadScore({
    timeline: input.timeline,
    email: input.email,
    phone: input.phone,
    source: input.source,
    interestedIn: input.interestedIn,
    description: input.description,
  });
  const priority = priorityFromScore(score);

  const slaSettings = await getSlaSettings(input.businessId);
  const minutesByPriority: Record<string, number> = {
    Hot: slaSettings.hot_minutes,
    High: slaSettings.high_minutes,
    Medium: slaSettings.medium_minutes,
    Low: slaSettings.low_minutes,
  };
  const slaDueAt = new Date(Date.now() + minutesByPriority[priority] * 60_000).toISOString();

  const assignedUserId = input.skipAutomation
    ? (input.assignedUserId ?? null)
    : (input.assignedUserId ?? (await resolveAssignment(input.businessId, { source: input.source, industry: input.industry, score })));

  const lead = await leadRepo.createLead({
    businessId: input.businessId,
    assignedUserId,
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    source: input.source,
    industry: input.industry,
    interestedIn: input.interestedIn,
    timeline: input.timeline,
    description: input.description,
    score,
    sourceDetail: input.sourceDetail,
    formId: input.formId,
    campaign: input.campaign,
    adSet: input.adSet,
    ad: input.ad,
    utmSource: input.utmSource,
    utmMedium: input.utmMedium,
    utmCampaign: input.utmCampaign,
    utmTerm: input.utmTerm,
    utmContent: input.utmContent,
    landingPage: input.landingPage,
    referrer: input.referrer,
    externalSource: input.externalSource,
    externalId: input.externalId,
    normalizedEmail,
    normalizedPhone,
    duplicateOfLeadId: potentialDuplicate?.id ?? null,
    priority,
    slaDueAt,
  });

  await activityRepo.createActivity({
    businessId: input.businessId,
    leadId: lead.id,
    userId: input.actorUserId ?? null,
    type: 'Lead created',
    description: `Lead "${lead.name}" was created via ${lead.source}.`,
  });

  if (potentialDuplicate) {
    await activityRepo.createActivity({
      businessId: input.businessId,
      leadId: lead.id,
      userId: input.actorUserId ?? null,
      type: 'Possible duplicate detected',
      description: `This lead may be a duplicate of an existing lead ("${potentialDuplicate.name}"). Review and merge if appropriate.`,
    });
  }

  if (input.skipAutomation) {
    return { lead, created: true, isDuplicate: Boolean(potentialDuplicate), duplicateOfLeadId: potentialDuplicate?.id };
  }

  if (assignedUserId) {
    await activityRepo.createActivity({
      businessId: input.businessId,
      leadId: lead.id,
      userId: input.actorUserId ?? null,
      type: 'Lead assigned',
      description: input.assignedUserId ? 'Lead was assigned.' : 'Lead was automatically assigned based on routing rules.',
    });
    await notifyUser(input.businessId, assignedUserId, {
      type: 'lead_assigned',
      title: 'New lead assigned to you',
      message: `${lead.name} (${priority} priority) was assigned to you.`,
      link: `/leads/${lead.id}`,
    });

    await followUpRepo.createFollowUp({
      businessId: input.businessId,
      leadId: lead.id,
      userId: assignedUserId,
      type: 'Call',
      scheduledAt: slaDueAt,
      notes: `Auto-scheduled: respond within ${minutesByPriority[priority]} minutes (${priority} priority lead).`,
    });
  } else if (priority === 'Hot' || priority === 'High') {
    await notifyOwner(input.businessId, {
      type: 'hot_lead',
      title: 'Hot lead requires attention',
      message: `${lead.name} scored ${score} (${priority} priority) and has no assigned salesperson yet.`,
      link: `/leads/${lead.id}`,
    });
  }

  await runAutomationRules(input.businessId, lead, { actorUserId: input.actorUserId ?? null });

  // Automation actions (e.g. assign_user) mutate the lead row directly, so
  // re-fetch to make sure the returned object reflects them.
  const finalLead = (await leadRepo.findLeadById(lead.id, input.businessId)) ?? lead;

  return { lead: finalLead, created: true, isDuplicate: Boolean(potentialDuplicate), duplicateOfLeadId: potentialDuplicate?.id };
}
