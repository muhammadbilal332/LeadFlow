import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createQuotationSchema, updateQuotationSchema } from '../validation/schemas';
import * as quotationRepo from '../repositories/quotationRepo';
import * as leadRepo from '../repositories/leadRepo';
import { ForbiddenError, NotFoundError } from '../utils/appError';

async function assertLeadAccess(req: Request, leadId: string) {
  const lead = await leadRepo.findLeadById(leadId, req.user!.businessId);
  if (!lead) throw new NotFoundError('Lead not found');
  if (req.user!.role === 'sales' && lead.assigned_user_id !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this lead');
  }
  return lead;
}

export const listQuotations = asyncHandler(async (req: Request, res: Response) => {
  await assertLeadAccess(req, req.params.id);
  const quotations = await quotationRepo.listQuotationsForLead(req.params.id, req.user!.businessId);
  res.json({ quotations });
});

export const createLeadQuotation = asyncHandler(async (req: Request, res: Response) => {
  const lead = await assertLeadAccess(req, req.params.id);
  const input = createQuotationSchema.parse({ ...req.body, leadId: lead.id });
  const quotation = await quotationRepo.createQuotation({
    businessId: req.user!.businessId,
    leadId: lead.id,
    createdBy: req.user!.userId,
    title: input.title,
    amount: input.amount,
    status: input.status,
    notes: input.notes,
  });
  res.status(201).json({ quotation });
});

export const updateLeadQuotation = asyncHandler(async (req: Request, res: Response) => {
  await assertLeadAccess(req, req.params.id);
  const input = updateQuotationSchema.parse(req.body);
  const updated = await quotationRepo.updateQuotation(req.params.quotationId, req.user!.businessId, input);
  if (!updated) throw new NotFoundError('Quotation not found');
  res.json({ quotation: updated });
});
