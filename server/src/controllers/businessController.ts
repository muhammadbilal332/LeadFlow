import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { updateBusinessSchema } from '../validation/schemas';
import * as businessRepo from '../repositories/businessRepo';
import { NotFoundError } from '../utils/appError';

export const getBusiness = asyncHandler(async (req: Request, res: Response) => {
  const business = await businessRepo.findBusinessById(req.user!.businessId);
  if (!business) throw new NotFoundError('Business not found');
  res.json({ business });
});

export const updateBusinessHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = updateBusinessSchema.parse(req.body);
  const updated = await businessRepo.updateBusiness(req.user!.businessId, {
    ...input,
    email: input.email === '' ? null : input.email,
  });
  if (!updated) throw new NotFoundError('Business not found');
  res.json({ business: updated });
});
