/**
 * Sends approved, due drafts. This is the ONLY place an email actually
 * leaves the system. Every send re-checks suppression immediately before
 * dispatch (a contact can be suppressed at any moment between approval and
 * send), is idempotent (a retried tick can never double-send the same
 * draft), and updates provider usage counters for scale-safety visibility.
 */
import { getEmailProvider } from '../../providers/email';
import { MockEmailProvider } from '../../providers/email/MockEmailProvider';
import * as campaignContactRepo from '../../repositories/campaignContactRepo';
import * as outreachContactRepo from '../../repositories/outreachContactRepo';
import * as outreachMessageRepo from '../../repositories/outreachMessageRepo';
import * as outreachEventRepo from '../../repositories/outreachEventRepo';
import * as outreachDraftRepo from '../../repositories/outreachDraftRepo';
import * as emailThreadRepo from '../../repositories/emailThreadRepo';
import * as providerUsageRepo from '../../repositories/providerUsageRepo';
import * as outreachCampaignRepo from '../../repositories/outreachCampaignRepo';
import * as emailSettingsRepo from '../../repositories/emailSettingsRepo';
import * as suppressionService from './suppressionService';
import { scheduleNextStep, findApprovedDraftForCurrentStep, generateDueDrafts } from './sequenceService';
import { env } from '../../config/env';
import { markLeadContacted } from '../leadStatusSyncService';
import * as userRepo from '../../repositories/userRepo';
import { firstNameOf, withSenderFirstName } from './signOff';

export interface SendCycleResult {
  draftsGenerated: number;
  sent: number;
  blocked: number;
  failed: number;
}

/** One full processing cycle: generate any newly-due drafts, then send every approved+ready draft. This is what the externally-schedulable /api/outreach/tick endpoint runs, and what a local demo can trigger on demand. */
export async function runTick(businessId: string): Promise<SendCycleResult> {
  const draftsGenerated = await generateDueDrafts(businessId);
  const sendResult = await sendApprovedDrafts(businessId);
  return { draftsGenerated, ...sendResult };
}

export async function sendApprovedDrafts(businessId: string): Promise<{ sent: number; blocked: number; failed: number }> {
  const provider = getEmailProvider();
  const readyContacts = await campaignContactRepo.findApprovedReadyToSend(businessId);

  let sent = 0;
  let blocked = 0;
  let failed = 0;

  for (const cc of readyContacts) {
    const outcome = await sendOneStep(cc, provider);
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'blocked') blocked += 1;
    else failed += 1;
  }

  return { sent, blocked, failed };
}

/**
 * Attempts to send the single campaign_contact's just-approved draft right
 * away, instead of waiting for the next scheduled tick — called right after
 * a human approves a draft. Only sends if its campaign is already
 * 'running' (e.g. an auto-pilot campaign, or one a human already started);
 * for a campaign still being manually reviewed, this is a no-op and the
 * draft simply waits in 'approved' until the campaign starts, exactly as
 * before.
 */
export async function sendOneApprovedDraft(businessId: string, campaignContactId: string): Promise<'sent' | 'blocked' | 'failed' | 'not_running'> {
  const cc = await campaignContactRepo.findById(campaignContactId, businessId);
  if (!cc) return 'blocked';

  const campaign = await outreachCampaignRepo.findCampaignById(cc.campaign_id, businessId);
  if (!campaign || campaign.status !== 'running') return 'not_running';

  return sendOneStep(cc, getEmailProvider());
}

async function sendOneStep(cc: import('../../repositories/campaignContactRepo').CampaignContactRow, provider: ReturnType<typeof getEmailProvider>): Promise<'sent' | 'blocked' | 'failed'> {
  const draft = await findApprovedDraftForCurrentStep(cc);
  if (!draft) return 'blocked';

  const contact = await outreachContactRepo.findById(cc.contact_id, cc.business_id);
  if (!contact) return 'blocked';

  // Re-check suppression immediately before sending — a contact can be
  // suppressed (unsubscribe/bounce/manual) at any point after approval.
  if (await suppressionService.isSuppressed(cc.business_id, contact.email)) {
    await campaignContactRepo.setStatus(cc.id, 'stopped', { stoppedReason: 'suppressed_before_send' });
    return 'blocked';
  }

  const idempotencyKey = `draft:${draft.id}`;
  const existingMessage = await outreachMessageRepo.findByIdempotencyKey(cc.business_id, idempotencyKey);
  if (existingMessage) {
    // Already processed — a retried tick must never attempt the send again.
    // A prior definitive failure must not be silently reported as 'sent',
    // and must not leave the contact stuck in 'approved' forever (which
    // would otherwise make every future tick re-discover and re-report it).
    if (existingMessage.status === 'failed') {
      await campaignContactRepo.setStatus(cc.id, 'failed');
      return 'failed';
    }
    return 'sent';
  }

  // A contact can be enrolled in more than one campaign (a sheet import and a
  // Lead's own follow-ups, for example), each with its own step 1. Never let a
  // second campaign send that first-contact email to someone already reached.
  if (draft.step_order === 1 && (await outreachMessageRepo.countSentForContact(cc.business_id, contact.id)) > 0) {
    await campaignContactRepo.setStatus(cc.id, 'stopped', { stoppedReason: 'already_contacted' });
    return 'blocked';
  }

  const [campaign, emailSettings] = await Promise.all([
    outreachCampaignRepo.findCampaignById(cc.campaign_id, cc.business_id),
    emailSettingsRepo.getSettings(cc.business_id),
  ]);
  if (!campaign) return 'failed';

  const senderName = campaign.sender_name || emailSettings?.default_sender_name || 'LeadFlow';
  const senderEmail = campaign.sender_email || emailSettings?.default_sender_email;
  if (!senderEmail) {
    console.error(`outreach: campaign ${campaign.id} has no sender email configured — skipping send`);
    return 'failed';
  }

  // Checked before creating the message row (and before consuming the
  // idempotency key) since hitting the daily limit is a transient condition
  // — the same draft must remain retryable on a later tick, once the limit
  // resets, rather than being permanently blocked like a real send failure.
  const dailyCount = await providerUsageRepo.getDailyCount(cc.business_id, provider.name, new Date().toISOString().slice(0, 10));
  const dailyLimit = emailSettings?.daily_send_limit ?? env.OUTREACH_DAILY_SEND_LIMIT;
  if (dailyCount >= dailyLimit) {
    return 'failed';
  }

  // The sign-off names whoever approved the draft, so the recipient knows who
  // they're talking to. The stored Sent copy is exactly what was dispatched.
  const approver = draft.approved_by ? await userRepo.findUserById(draft.approved_by) : null;
  const body = withSenderFirstName(draft.final_body ?? draft.naturalized_body, firstNameOf(approver?.name), senderName);
  const message = await outreachMessageRepo.createMessage({
    businessId: cc.business_id,
    campaignContactId: cc.id,
    draftId: draft.id,
    provider: provider.name,
    subject: draft.subject,
    body,
    idempotencyKey,
  });

  const result = await provider.sendEmail({
    businessId: cc.business_id,
    to: contact.email,
    fromName: senderName,
    fromEmail: senderEmail,
    replyTo: campaign.reply_to,
    subject: draft.subject,
    body,
    idempotencyKey,
  });

  if (result.status === 'failed') {
    await outreachMessageRepo.markFailed(message.id, result.error || 'Send failed');
    await outreachEventRepo.recordEvent({ businessId: cc.business_id, messageId: message.id, type: 'failed', payload: { error: result.error } });
    await providerUsageRepo.recordSend(cc.business_id, provider.name, 'failed');
    // Move the contact out of 'approved' so it stops being rediscovered as
    // ready-to-send on every future tick; a human can review it under the
    // campaign and regenerate/retry manually if appropriate.
    await campaignContactRepo.setStatus(cc.id, 'failed');
    return 'failed';
  }

  const thread = await emailThreadRepo.findOrCreate({ businessId: cc.business_id, campaignId: campaign.id, contactId: contact.id, subject: draft.subject });
  await outreachMessageRepo.markSent(message.id, result.providerMessageId, thread.id);
  await outreachEventRepo.recordEvent({ businessId: cc.business_id, messageId: message.id, type: 'sent' });
  await outreachDraftRepo.setStatus(draft.id, cc.business_id, 'sent');
  await providerUsageRepo.recordSend(cc.business_id, provider.name, 'sent');

  // Automatic New -> Contacted CRM lead transition, only for a contact
  // that's linked to a real lead (sheet imports, direct lead composer sends).
  if (contact.lead_id) {
    await markLeadContacted(cc.business_id, contact.lead_id);
  }

  // Mock provider has no real async delivery webhook — simulate near-instant
  // delivery (or a bounce for addresses that deliberately simulate one) so
  // the demo/test flow shows a realistic delivered state without needing a
  // webhook call.
  if (provider.name === 'mock') {
    if (MockEmailProvider.isSimulatedBounce(contact.email)) {
      await outreachMessageRepo.markBounced(message.id, 'Simulated hard bounce (mock)');
      await outreachEventRepo.recordEvent({ businessId: cc.business_id, messageId: message.id, type: 'bounced' });
      await providerUsageRepo.recordSend(cc.business_id, provider.name, 'bounced');
      await suppressionService.suppress(cc.business_id, contact.email, 'bounce', 'mock_provider');
      return 'sent';
    }
    await outreachMessageRepo.markDelivered(message.id);
    await outreachEventRepo.recordEvent({ businessId: cc.business_id, messageId: message.id, type: 'delivered' });
  }

  await scheduleNextStep(cc);
  return 'sent';
}
