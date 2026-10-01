/**
 * Drives a contact through a campaign's sequence, one step at a time.
 * Nothing here ever sends an email — it only prepares drafts (via
 * personalizationService) and schedules when the next step becomes due.
 * Sending happens exclusively in outreachQueueService, and only for drafts
 * a human has approved.
 */
import * as campaignContactRepo from '../../repositories/campaignContactRepo';
import * as outreachCampaignRepo from '../../repositories/outreachCampaignRepo';
import * as outreachSequenceRepo from '../../repositories/outreachSequenceRepo';
import * as outreachDraftRepo from '../../repositories/outreachDraftRepo';
import * as emailSettingsRepo from '../../repositories/emailSettingsRepo';
import { generateDraft, getBusinessName } from './personalizationService';
import { CampaignContactRow } from '../../repositories/campaignContactRepo';

/**
 * Adds contacts to a campaign and immediately generates their step-1 draft
 * (if the campaign has a sequence attached) — the single shared path behind
 * both "add contacts manually" and "import from sheet straight into this
 * campaign." Never sends anything; drafts still require human approval.
 */
export async function addContactsAndGenerateDrafts(
  businessId: string,
  campaign: import('../../repositories/outreachCampaignRepo').OutreachCampaignRow,
  contactIds: string[]
): Promise<{ added: number; draftsGenerated: number }> {
  let added = 0;
  for (const contactId of contactIds) {
    const { created } = await campaignContactRepo.addContactToCampaign(businessId, campaign.id, contactId);
    if (created) added += 1;
  }

  let draftsGenerated = 0;
  if (added > 0 && campaign.sequence_id) {
    if (campaign.status === 'draft') {
      await outreachCampaignRepo.setStatus(campaign.id, businessId, 'review');
    }
    draftsGenerated = await generateDueDrafts(businessId);
  }

  return { added, draftsGenerated };
}

/** Generates the step-(current_step+1) draft for every campaign_contact whose scheduled time has arrived. Returns how many drafts were generated. */
export async function generateDueDrafts(businessId: string): Promise<number> {
  const due = await campaignContactRepo.findPendingDraftGeneration(businessId);
  let generated = 0;

  for (const cc of due) {
    try {
      await generateDraftForStep(cc);
      generated += 1;
    } catch (err) {
      console.error(`outreach: failed to generate draft for campaign_contact ${cc.id}:`, err instanceof Error ? err.message : err);
    }
  }

  return generated;
}

export async function generateDraftForStep(cc: CampaignContactRow): Promise<import('../../repositories/outreachDraftRepo').OutreachDraftRow> {
  const campaign = await outreachCampaignRepo.findCampaignById(cc.campaign_id, cc.business_id);
  if (!campaign || !campaign.sequence_id) throw new Error('Campaign or sequence not found');

  const steps = await outreachSequenceRepo.listSteps(campaign.sequence_id);
  const nextStep = steps.find((s) => s.step_order === cc.current_step + 1 && s.is_enabled);
  if (!nextStep) throw new Error('No enabled next step found in sequence');

  const [businessName, emailSettings] = await Promise.all([getBusinessName(cc.business_id), emailSettingsRepo.getSettings(cc.business_id)]);

  const draft = await generateDraft({
    campaignContact: cc,
    campaign,
    step: nextStep,
    totalSteps: steps.length,
    businessName,
    emailSettings,
  });

  await campaignContactRepo.setStatus(cc.id, 'drafted');
  return draft;
}

/** Called when a human approves a draft — makes the campaign_contact eligible for the send phase of the next queue tick. */
export async function onDraftApproved(campaignContactId: string): Promise<void> {
  await campaignContactRepo.setStatus(campaignContactId, 'approved');
}

export async function onDraftRejected(campaignContactId: string): Promise<void> {
  await campaignContactRepo.setStatus(campaignContactId, 'pending');
}

/** Called by outreachQueueService right after a step's email was successfully sent — schedules the next step, or finalizes the contact if the sequence is complete. */
export async function scheduleNextStep(cc: CampaignContactRow): Promise<void> {
  const campaign = await outreachCampaignRepo.findCampaignById(cc.campaign_id, cc.business_id);
  if (!campaign?.sequence_id) {
    await campaignContactRepo.setStatus(cc.id, 'sent');
    return;
  }

  const steps = await outreachSequenceRepo.listSteps(campaign.sequence_id);
  const sentStep = cc.current_step + 1;
  const next = steps.find((s) => s.step_order === sentStep + 1 && s.is_enabled);

  if (!next) {
    await campaignContactRepo.advanceStep(cc.id, sentStep, null);
    await campaignContactRepo.setStatus(cc.id, 'sent');
    return;
  }

  const nextSendAt = new Date(Date.now() + next.delay_days * 24 * 60 * 60 * 1000).toISOString();
  await campaignContactRepo.advanceStep(cc.id, sentStep, nextSendAt);
  await campaignContactRepo.setStatus(cc.id, 'pending');
}

export async function findApprovedDraftForCurrentStep(cc: CampaignContactRow): Promise<import('../../repositories/outreachDraftRepo').OutreachDraftRow | null> {
  const drafts = await outreachDraftRepo.listForCampaignContact(cc.id);
  return drafts.find((d) => d.step_order === cc.current_step + 1 && d.status === 'approved') ?? null;
}
