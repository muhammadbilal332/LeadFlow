import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as outreachMessageRepo from '../repositories/outreachMessageRepo';
import * as outreachEventRepo from '../repositories/outreachEventRepo';

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const messages = await outreachMessageRepo.listForBusiness(req.user!.businessId);
  res.json({ messages });
});

/** Backs the Sent folder: every outgoing email with recipient/lead context, scoped to the caller's own assigned leads when they're a sales user. */
export const listSentMessages = asyncHandler(async (req: Request, res: Response) => {
  const restrictToUserId = req.user!.role === 'sales' ? req.user!.userId : undefined;
  const messages = await outreachMessageRepo.listForBusinessWithRecipient(req.user!.businessId, { restrictToUserId });
  res.json({ messages });
});

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await outreachEventRepo.listForBusiness(req.user!.businessId);
  res.json({ events });
});
