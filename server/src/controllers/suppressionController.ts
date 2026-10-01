import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { addSuppressionSchema } from '../validation/outreachSchemas';
import * as suppressionRepo from '../repositories/suppressionRepo';
import { suppress } from '../services/outreach/suppressionService';
import { normalizeEmail } from '../utils/normalize';
import { BadRequestError } from '../utils/appError';

export const listSuppressions = asyncHandler(async (req: Request, res: Response) => {
  const suppressions = await suppressionRepo.listSuppressions(req.user!.businessId);
  res.json({ suppressions });
});

export const addSuppression = asyncHandler(async (req: Request, res: Response) => {
  const input = addSuppressionSchema.parse(req.body);
  await suppress(req.user!.businessId, input.email, input.reason, 'manual_entry');
  res.status(201).json({ success: true });
});

export const removeSuppression = asyncHandler(async (req: Request, res: Response) => {
  const normalizedEmail = normalizeEmail(req.params.email);
  if (!normalizedEmail) throw new BadRequestError('Invalid email');
  const removed = await suppressionRepo.removeSuppression(req.user!.businessId, normalizedEmail);
  res.json({ removed });
});
