import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getEmailProvider } from '../providers/email';
import { getOutreachAIProvider } from '../providers/ai';
import { getSheetsProvider } from '../providers/sheets';
import { getInboundProvider } from '../providers/inbound';
import { env } from '../config/env';
import * as providerUsageRepo from '../repositories/providerUsageRepo';

export const getProviders = asyncHandler(async (_req: Request, res: Response) => {
  const email = getEmailProvider();
  const ai = getOutreachAIProvider();
  const sheets = getSheetsProvider();
  const inbound = getInboundProvider();

  res.json({
    providers: {
      email: { name: email.name, configured: email.isConfigured(), selected: env.EMAIL_PROVIDER },
      ai: { name: ai.name, configured: ai.isConfigured(), selected: env.OUTREACH_AI_PROVIDER },
      sheets: { name: sheets.name, configured: sheets.isConfigured(), selected: env.SHEETS_PROVIDER },
      inbound: { name: inbound.name, configured: inbound.isConfigured(), selected: env.INBOUND_PROVIDER },
    },
  });
});

export const getUsage = asyncHandler(async (req: Request, res: Response) => {
  const email = getEmailProvider();
  const usage = await providerUsageRepo.getUsageSummary(req.user!.businessId, email.name);
  res.json({ provider: email.name, usage, dailyLimit: env.OUTREACH_DAILY_SEND_LIMIT });
});
