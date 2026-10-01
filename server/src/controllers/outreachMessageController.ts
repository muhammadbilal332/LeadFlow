import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as outreachMessageRepo from '../repositories/outreachMessageRepo';
import * as outreachEventRepo from '../repositories/outreachEventRepo';

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const messages = await outreachMessageRepo.listForBusiness(req.user!.businessId);
  res.json({ messages });
});

export const listEvents = asyncHandler(async (req: Request, res: Response) => {
  const events = await outreachEventRepo.listForBusiness(req.user!.businessId);
  res.json({ events });
});
