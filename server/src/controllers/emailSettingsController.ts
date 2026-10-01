import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { emailSettingsSchema } from '../validation/outreachSchemas';
import * as emailSettingsRepo from '../repositories/emailSettingsRepo';

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await emailSettingsRepo.getSettings(req.user!.businessId);
  res.json({ settings });
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const input = emailSettingsSchema.parse(req.body);
  const settings = await emailSettingsRepo.upsertSettings({
    businessId: req.user!.businessId,
    defaultSenderName: input.defaultSenderName,
    defaultSenderEmail: input.defaultSenderEmail || null,
    defaultReplyTo: input.defaultReplyTo || null,
    dailySendLimit: input.dailySendLimit,
    voiceDescription: input.voiceDescription,
  });
  res.json({ settings });
});
