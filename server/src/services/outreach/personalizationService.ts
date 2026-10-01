import { getOutreachAIProvider } from '../../providers/ai';
import { naturalizeEmail } from './naturalCommunicationEngine';
import { checkDraft } from './qualityCheckService';
import * as outreachContactRepo from '../../repositories/outreachContactRepo';
import * as outreachDraftRepo from '../../repositories/outreachDraftRepo';
import * as outreachMessageRepo from '../../repositories/outreachMessageRepo';
import * as aiGenerationLogRepo from '../../repositories/aiGenerationLogRepo';
import { OutreachCampaignRow } from '../../repositories/outreachCampaignRepo';
import { SequenceStepRow } from '../../repositories/outreachSequenceRepo';
import { CampaignContactRow } from '../../repositories/campaignContactRepo';
import { EmailSettingsRow } from '../../repositories/emailSettingsRepo';
import * as businessRepo from '../../repositories/businessRepo';

/**
 * Generates one draft for one campaign_contact at one sequence step:
 * AI personalization -> Natural Communication Engine -> Quality Check ->
 * persisted outreach_drafts row. Never sends anything and never bypasses
 * human approval — this only prepares what a human will review.
 */
export async function generateDraft(input: {
  campaignContact: CampaignContactRow;
  campaign: OutreachCampaignRow;
  step: SequenceStepRow;
  totalSteps: number;
  businessName: string;
  emailSettings: EmailSettingsRow | null;
}): Promise<import('../../repositories/outreachDraftRepo').OutreachDraftRow> {
  const contact = await outreachContactRepo.findById(input.campaignContact.contact_id, input.campaignContact.business_id);
  if (!contact) throw new Error('Contact not found for draft generation');

  const provider = getOutreachAIProvider();

  const generated = await provider.generateEmail(
    {
      contactName: contact.contact_name,
      companyName: contact.company_name,
      brandName: contact.brand_name,
      industry: contact.industry,
      website: contact.website,
      location: contact.location,
      painPoints: contact.pain_points,
      possibleSolution: contact.possible_solution,
      notes: contact.notes,
    },
    {
      stepOrder: input.step.step_order,
      totalSteps: input.totalSteps,
      subjectTemplate: input.step.subject_template,
      bodyTemplate: input.step.body_template,
      isFollowUp: input.step.step_order > 1,
    },
    {
      businessName: input.businessName,
      senderName: input.campaign.sender_name || input.businessName,
      voiceDescription: input.emailSettings?.voice_description ?? null,
    }
  );

  await aiGenerationLogRepo.logGeneration({
    businessId: input.campaignContact.business_id,
    campaignContactId: input.campaignContact.id,
    provider: provider.name,
    promptSummary: `step ${input.step.step_order} for ${contact.email}`,
    outputSummary: `${generated.subject} (${generated.body.length} chars)`,
  });

  const naturalized = naturalizeEmail(generated.body);
  // A visible, truthful opt-out line: no fake unsubscribe link, just the
  // same reply-based mechanism the system already honors (see
  // sequenceService's suppression handling). This is both a CAN-SPAM
  // baseline and a real spam-filter signal — a cold email with no opt-out
  // mention at all reads as more suspicious to Gmail/Outlook than one that
  // has it, on top of being the compliant thing to do. Skipped for
  // follow-up steps so repeat threads don't repeat the line.
  if (input.step.step_order === 1) {
    naturalized.body = `${naturalized.body}\n\n—\nNot interested? Just reply "unsubscribe" and you won't hear from us again.`;
  }

  const previousMessages = await outreachMessageRepo.listForCampaignContact(input.campaignContact.id);
  const quality = await checkDraft({
    businessId: input.campaignContact.business_id,
    toEmail: contact.email,
    normalizedToEmail: contact.normalized_email,
    subject: generated.subject,
    body: naturalized.body,
    previousBodies: previousMessages.map((m) => m.body),
  });

  return outreachDraftRepo.createDraft({
    businessId: input.campaignContact.business_id,
    campaignContactId: input.campaignContact.id,
    stepOrder: input.step.step_order,
    subject: generated.subject,
    aiRawBody: generated.body,
    naturalizedBody: naturalized.body,
    qualityStatus: quality.status,
    qualityIssues: quality.issues,
  });
}

export async function getBusinessName(businessId: string): Promise<string> {
  const business = await businessRepo.findBusinessById(businessId);
  return business?.name ?? 'Our team';
}
