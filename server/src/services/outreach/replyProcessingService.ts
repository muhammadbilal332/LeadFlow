/**
 * Ingests an inbound reply (from a real provider webhook or the mock
 * simulate-reply endpoint), classifies it, permanently stops any further
 * follow-ups to that contact, and — for a genuinely engaged reply —
 * finds-or-creates the corresponding CRM lead via the same central intake
 * pipeline every other lead source uses, then notifies a salesperson.
 * Never creates a duplicate lead: an existing lead for the same email is
 * always found and reused.
 */
import { InboundEmailEvent } from '../../providers/inbound/InboundProvider';
import * as outreachContactRepo from '../../repositories/outreachContactRepo';
import * as emailThreadRepo from '../../repositories/emailThreadRepo';
import * as emailReplyRepo from '../../repositories/emailReplyRepo';
import * as outreachMessageRepo from '../../repositories/outreachMessageRepo';
import * as campaignContactRepo from '../../repositories/campaignContactRepo';
import * as leadRepo from '../../repositories/leadRepo';
import * as activityRepo from '../../repositories/activityRepo';
import { intakeLead } from '../leadIntakeService';
import { notifyUser, notifyOwner } from '../notificationService';
import { normalizeEmail } from '../../utils/normalize';
import { classifyReply } from './replyClassifier';
import * as suppressionService from './suppressionService';
import { ReplyClassification } from '../../repositories/emailReplyRepo';
import { markLeadReplied } from '../leadStatusSyncService';

const LEAD_CREATING_CLASSIFICATIONS: ReplyClassification[] = ['interested', 'meeting_request', 'question', 'referral'];

export interface ProcessReplyResult {
  skipped: boolean;
  reason?: string;
  classification?: ReplyClassification;
  leadId?: string;
  leadCreated?: boolean;
}

export async function processInboundReply(businessId: string, event: InboundEmailEvent): Promise<ProcessReplyResult> {
  const existingReply = await emailReplyRepo.findByProviderReplyId(businessId, event.providerReplyId);
  if (existingReply) return { skipped: true, reason: 'duplicate_webhook_delivery' };

  const normalizedFrom = normalizeEmail(event.fromEmail);
  if (!normalizedFrom) return { skipped: true, reason: 'invalid_from_address' };

  const contact = await outreachContactRepo.findByNormalizedEmail(businessId, normalizedFrom);
  if (!contact) return { skipped: true, reason: 'no_matching_contact' };

  const message = event.providerMessageId ? await outreachMessageRepo.findByProviderMessageId(businessId, event.providerMessageId) : null;

  const threads = await emailThreadRepo.findByContact(businessId, contact.id);
  const thread = threads[0];
  if (!thread) return { skipped: true, reason: 'no_thread_for_contact' };

  const classification = classifyReply(event.body);

  await emailReplyRepo.createReply({
    businessId,
    threadId: thread.id,
    contactId: contact.id,
    messageId: message?.id ?? null,
    fromEmail: event.fromEmail,
    subject: event.subject,
    body: event.body,
    classification,
    providerReplyId: event.providerReplyId,
  });

  // Any reply — regardless of sentiment — must stop further scheduled
  // follow-ups to this contact.
  await campaignContactRepo.stopAllForContact(businessId, contact.id, `reply:${classification}`);
  await outreachContactRepo.setStatus(contact.id, businessId, 'active');

  if (classification === 'unsubscribe') {
    await suppressionService.suppress(businessId, contact.email, 'unsubscribe', 'reply_detected');
    return { skipped: false, classification };
  }

  if (!LEAD_CREATING_CLASSIFICATIONS.includes(classification)) {
    if (contact.lead_id) {
      await markLeadReplied(businessId, contact.lead_id);
    }
    await notifyOwner(businessId, {
      type: 'outreach_reply',
      title: `Reply received (${classification.replace('_', ' ')})`,
      message: `${contact.contact_name || contact.email} replied to your outreach campaign.`,
      link: '/outreach/replies',
    });
    return { skipped: false, classification };
  }

  const existingLead = await leadRepo.findPotentialDuplicate(businessId, normalizedFrom, null);

  if (existingLead) {
    await activityRepo.createActivity({
      businessId,
      leadId: existingLead.id,
      userId: null,
      type: 'Outreach reply received',
      description: `${contact.contact_name || contact.email} replied (${classification.replace('_', ' ')}): "${event.body.slice(0, 200)}"`,
    });
    await outreachContactRepo.linkToLead(contact.id, businessId, existingLead.id);
    await markLeadReplied(businessId, existingLead.id);

    if (existingLead.assigned_user_id) {
      await notifyUser(businessId, existingLead.assigned_user_id, {
        type: 'outreach_reply',
        title: 'Outreach reply on an existing lead',
        message: `${existingLead.name} replied to an outreach email (${classification.replace('_', ' ')}).`,
        link: `/leads/${existingLead.id}`,
      });
    } else {
      await notifyOwner(businessId, {
        type: 'outreach_reply',
        title: 'Outreach reply on an existing lead',
        message: `${existingLead.name} replied to an outreach email (${classification.replace('_', ' ')}).`,
        link: `/leads/${existingLead.id}`,
      });
    }

    return { skipped: false, classification, leadId: existingLead.id, leadCreated: false };
  }

  const result = await intakeLead({
    businessId,
    name: contact.contact_name || contact.company_name || contact.email,
    email: contact.email,
    company: contact.company_name,
    industry: contact.industry,
    description: `Replied to outreach email (${classification.replace('_', ' ')}): "${event.body.slice(0, 300)}"`,
    source: 'Other',
    sourceDetail: 'Outreach reply',
    externalSource: 'outreach',
  });

  await outreachContactRepo.linkToLead(contact.id, businessId, result.lead.id);
  await markLeadReplied(businessId, result.lead.id);

  return { skipped: false, classification, leadId: result.lead.id, leadCreated: result.created };
}
