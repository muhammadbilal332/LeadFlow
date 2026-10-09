import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createContactSchema } from '../validation/outreachSchemas';
import * as outreachContactRepo from '../repositories/outreachContactRepo';
import * as outreachMessageRepo from '../repositories/outreachMessageRepo';
import * as leadRepo from '../repositories/leadRepo';
import { listFollowUpQueue } from '../services/outreach/followUpQueueService';
import { normalizeEmail } from '../utils/normalize';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/appError';

function restrictToUserIdFor(req: Request): string | undefined {
  return req.user!.role === 'sales' ? req.user!.userId : undefined;
}

export const listContacts = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, page = '1', pageSize = '25' } = req.query as Record<string, string>;
  const limit = Math.min(Number(pageSize) || 25, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;
  const restrictToUserId = restrictToUserIdFor(req);

  const { contacts, total } = await outreachContactRepo.listContacts(req.user!.businessId, {
    search,
    status,
    limit,
    offset,
    restrictToUserId,
  });

  // Enriches each contact with whether it's ever actually been emailed (so
  // the UI can stop offering "Generate draft" and show "Email sent"
  // instead) and whether a reply-free follow-up step is due right now (so
  // the UI can highlight it and offer a follow-up draft instead of a
  // first-contact one).
  const contactIds = contacts.map((c) => c.id);
  const [sentContactIds, followUps] = await Promise.all([
    outreachMessageRepo.listContactIdsWithSentMessage(req.user!.businessId, contactIds),
    listFollowUpQueue(req.user!.businessId, restrictToUserId),
  ]);
  const followUpByContact = new Map(followUps.map((f) => [f.contact_id, f]));

  const enriched = contacts.map((c) => {
    const followUp = followUpByContact.get(c.id);
    return {
      ...c,
      has_sent_message: sentContactIds.has(c.id),
      follow_up_due: followUp
        ? { campaign_contact_id: followUp.campaign_contact_id, bucket: followUp.bucket, has_draft: followUp.has_draft }
        : null,
    };
  });

  res.json({ contacts: enriched, total, page: Number(page) || 1, pageSize: limit });
});

export const getContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await outreachContactRepo.findById(req.params.id, req.user!.businessId);
  if (!contact) throw new NotFoundError('Contact not found');

  if (req.user!.role === 'sales') {
    const lead = contact.lead_id ? await leadRepo.findLeadById(contact.lead_id, req.user!.businessId) : null;
    if (!lead || lead.assigned_user_id !== req.user!.userId) {
      throw new ForbiddenError('You do not have access to this contact');
    }
  }

  res.json({ contact });
});

export const createContact = asyncHandler(async (req: Request, res: Response) => {
  const input = createContactSchema.parse(req.body);
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) throw new BadRequestError('A valid email is required');

  const { contact, created } = await outreachContactRepo.upsertContact({
    businessId: req.user!.businessId,
    companyName: input.companyName,
    brandName: input.brandName,
    contactName: input.contactName,
    email: input.email,
    normalizedEmail,
    website: input.website,
    industry: input.industry,
    location: input.location,
    painPoints: input.painPoints,
    possibleSolution: input.possibleSolution,
    notes: input.notes,
    source: 'manual',
  });

  res.status(created ? 201 : 200).json({ contact, created });
});

export const deleteContact = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await outreachContactRepo.deleteContact(req.params.id, req.user!.businessId);
  if (!deleted) throw new NotFoundError('Contact not found');
  res.status(204).send();
});
