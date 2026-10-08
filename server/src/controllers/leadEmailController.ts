import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as leadRepo from '../repositories/leadRepo';
import * as outreachContactRepo from '../repositories/outreachContactRepo';
import * as emailThreadRepo from '../repositories/emailThreadRepo';
import * as outreachMessageRepo from '../repositories/outreachMessageRepo';
import * as emailReplyRepo from '../repositories/emailReplyRepo';
import { getOrGenerateComposerDraft } from '../services/outreach/directLeadOutreachService';
import { getFollowUpStatusForLead } from '../services/outreach/followUpQueueService';
import { NotFoundError, ForbiddenError } from '../utils/appError';
import { normalizeEmail } from '../utils/normalize';
import { canReadLeadReplies } from '../utils/replyAccess';

async function assertLeadAccess(req: Request, leadId: string) {
  const lead = await leadRepo.findLeadById(leadId, req.user!.businessId);
  if (!lead) throw new NotFoundError('Lead not found');
  if (req.user!.role === 'sales' && lead.assigned_user_id !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this lead');
  }
  return lead;
}

/**
 * Lead Details "Email History": every thread this lead's linked contact has
 * ever had, each with its full chronological conversation — outgoing
 * outreach_messages and incoming email_replies merged and sorted, exactly
 * what the UI needs to render each topic's complete back-and-forth rather
 * than just the latest message.
 */
export const getLeadEmailHistory = asyncHandler(async (req: Request, res: Response) => {
  const lead = await assertLeadAccess(req, req.params.id);
  const contact =
    (await outreachContactRepo.findByLeadId(lead.id, req.user!.businessId)) ??
    (lead.email ? await outreachContactRepo.findByNormalizedEmail(req.user!.businessId, normalizeEmail(lead.email) ?? '') : null);
  if (!contact) {
    res.json({ contact: null, threads: [], followUpStatus: await getFollowUpStatusForLead(req.user!.businessId, null) });
    return;
  }

  const [threads, messages, allReplies, followUpStatus] = await Promise.all([
    emailThreadRepo.findByContact(req.user!.businessId, contact.id),
    outreachMessageRepo.listForContact(req.user!.businessId, contact.id),
    emailReplyRepo.listForContact(req.user!.businessId, contact.id),
    getFollowUpStatusForLead(req.user!.businessId, contact.id),
  ]);
  // Replies are private to the assigned salesperson and the owner.
  const replies = canReadLeadReplies(req.user!, lead.assigned_user_id) ? allReplies : [];

  const threadsWithConversation = threads.map((thread) => {
    const outgoing = messages
      .filter((m) => m.thread_id === thread.id)
      .map((m) => ({ direction: 'outgoing' as const, id: m.id, subject: m.subject, body: m.body, status: m.status, at: m.sent_at ?? m.created_at }));
    const incoming = replies
      .filter((r) => r.thread_id === thread.id)
      .map((r) => ({ direction: 'incoming' as const, id: r.id, subject: r.subject, body: r.body, classification: r.classification, at: r.created_at }));

    const conversation = [...outgoing, ...incoming].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    return {
      id: thread.id,
      subject: thread.subject,
      createdAt: thread.created_at,
      lastActivityAt: conversation.length > 0 ? conversation[conversation.length - 1].at : thread.created_at,
      conversation,
    };
  });

  threadsWithConversation.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());

  res.json({ contact, threads: threadsWithConversation, followUpStatus });
});

/**
 * AI Email Composer entry point: ensures the lead is wired into the direct
 * outreach system and returns the current step's draft (generating it if
 * needed) for the employee to review/edit before sending. Never sends.
 */
export const composeLeadEmail = asyncHandler(async (req: Request, res: Response) => {
  const lead = await assertLeadAccess(req, req.params.id);
  const { draft, campaignContact } = await getOrGenerateComposerDraft(req.user!.businessId, lead, req.user!.userId);
  res.json({ draft, campaignContactId: campaignContact.id, stepOrder: campaignContact.current_step + 1 });
});
