import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as emailReplyRepo from '../repositories/emailReplyRepo';
import * as emailThreadRepo from '../repositories/emailThreadRepo';
import * as outreachMessageRepo from '../repositories/outreachMessageRepo';
import * as outreachContactRepo from '../repositories/outreachContactRepo';
import * as leadRepo from '../repositories/leadRepo';
import { NotFoundError, ForbiddenError } from '../utils/appError';
import { replyScopeFor, canReadLeadReplies } from '../utils/replyAccess';

/** The Gmail-style Inbox list: every reply on a lead the viewer may read, newest first, with sender/subject/date/lead context. */
export const listInbox = asyncHandler(async (req: Request, res: Response) => {
  const replies = await emailReplyRepo.listForBusinessWithContext(req.user!.businessId, { restrictToUserId: replyScopeFor(req.user!) });
  res.json({ replies });
});

/** Opening a conversation from the Inbox: the full chronological thread (outgoing + incoming) for one email_threads row. */
export const getThreadConversation = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.user!.businessId;
  const thread = await emailThreadRepo.findById(req.params.threadId, businessId);
  if (!thread) throw new NotFoundError('Conversation not found');

  const contact = await outreachContactRepo.findById(thread.contact_id, businessId);
  const lead = contact?.lead_id ? await leadRepo.findLeadById(contact.lead_id, businessId) : null;
  const canRead = canReadLeadReplies(req.user!, lead?.assigned_user_id);
  if (!canRead) throw new ForbiddenError('You do not have access to this conversation');

  const [messages, replies] = await Promise.all([
    outreachMessageRepo.listForContact(businessId, thread.contact_id),
    emailReplyRepo.listForContact(businessId, thread.contact_id),
  ]);
  await emailReplyRepo.markThreadRead(businessId, thread.id);

  const outgoing = messages
    .filter((m) => m.thread_id === thread.id)
    .map((m) => ({ direction: 'outgoing' as const, id: m.id, subject: m.subject, body: m.body, status: m.status, at: m.sent_at ?? m.created_at }));
  const incoming = replies
    .filter((r) => r.thread_id === thread.id)
    .map((r) => ({ direction: 'incoming' as const, id: r.id, subject: r.subject, body: r.body, classification: r.classification, at: r.created_at }));

  const conversation = [...outgoing, ...incoming].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  res.json({ thread, conversation });
});
