import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createContactSchema } from '../validation/outreachSchemas';
import * as outreachContactRepo from '../repositories/outreachContactRepo';
import { normalizeEmail } from '../utils/normalize';
import { NotFoundError, BadRequestError } from '../utils/appError';

export const listContacts = asyncHandler(async (req: Request, res: Response) => {
  const { search, status, page = '1', pageSize = '25' } = req.query as Record<string, string>;
  const limit = Math.min(Number(pageSize) || 25, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

  const { contacts, total } = await outreachContactRepo.listContacts(req.user!.businessId, { search, status, limit, offset });
  res.json({ contacts, total, page: Number(page) || 1, pageSize: limit });
});

export const getContact = asyncHandler(async (req: Request, res: Response) => {
  const contact = await outreachContactRepo.findById(req.params.id, req.user!.businessId);
  if (!contact) throw new NotFoundError('Contact not found');
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
