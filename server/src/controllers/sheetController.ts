import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sheetConnectionSchema, runImportSchema } from '../validation/outreachSchemas';
import * as sheetRepo from '../repositories/sheetRepo';
import * as outreachCampaignRepo from '../repositories/outreachCampaignRepo';
import { runImport } from '../services/outreach/sheetsImportService';
import { addContactsAndGenerateDrafts } from '../services/outreach/sequenceService';
import { getOrCreateAutoPilotCampaign } from '../services/outreach/autoPilotService';
import { getSheetsProvider } from '../providers/sheets';
import { env } from '../config/env';
import { NotFoundError } from '../utils/appError';

export const getConnection = asyncHandler(async (req: Request, res: Response) => {
  const connection = await sheetRepo.findConnectionByBusiness(req.user!.businessId);
  res.json({ connection, provider: { name: getSheetsProvider().name, selected: env.SHEETS_PROVIDER } });
});

export const upsertConnection = asyncHandler(async (req: Request, res: Response) => {
  const input = sheetConnectionSchema.parse(req.body);
  const connection = await sheetRepo.upsertConnection({
    businessId: req.user!.businessId,
    name: input.name,
    provider: env.SHEETS_PROVIDER,
    spreadsheetId: input.spreadsheetId,
    sheetRange: input.sheetRange,
    columnMapping: input.columnMapping,
  });
  res.status(201).json({ connection });
});

export const disconnectConnection = asyncHandler(async (req: Request, res: Response) => {
  await sheetRepo.disableConnection(req.user!.businessId);
  res.status(204).send();
});

export const listImports = asyncHandler(async (req: Request, res: Response) => {
  const imports = await sheetRepo.listImports(req.user!.businessId);
  res.json({ imports });
});

/**
 * Imports from the connected sheet (or the mock dataset). By default (no
 * `campaignId` given and `skipAutoCampaign` not set), auto-pilot takes
 * over: a campaign and single-step sequence are created (or an existing
 * auto-pilot campaign for this connection is reused), every contact this
 * run touched is added to it, and step-1 drafts are generated immediately
 * — "import the sheet, draft the emails, hold for approval" happens in one
 * action with no manual campaign/sequence setup. Passing `campaignId`
 * targets a specific existing campaign instead; passing `skipAutoCampaign`
 * imports contacts only, with no campaign action at all.
 */
export const triggerImport = asyncHandler(async (req: Request, res: Response) => {
  const input = runImportSchema.parse(req.body ?? {});
  let connection = input.connectionId ? null : await sheetRepo.findConnectionByBusiness(req.user!.businessId);

  if (input.connectionId) {
    const found = await sheetRepo.findConnectionByBusiness(req.user!.businessId);
    if (!found || found.id !== input.connectionId) throw new NotFoundError('Sheet connection not found');
    connection = found;
  }

  let campaign = null;
  if (input.campaignId) {
    campaign = await outreachCampaignRepo.findCampaignById(input.campaignId, req.user!.businessId);
    if (!campaign) throw new NotFoundError('Campaign not found');
  } else if (!input.skipAutoCampaign) {
    campaign = await getOrCreateAutoPilotCampaign(req.user!.businessId, connection, req.user!.userId);
  }

  const { importRow, contactIds } = await runImport(req.user!.businessId, connection, req.user!.userId);

  let campaignResult: { added: number; draftsGenerated: number } | undefined;
  if (campaign && contactIds.length > 0) {
    campaignResult = await addContactsAndGenerateDrafts(req.user!.businessId, campaign, contactIds);
    campaign = (await outreachCampaignRepo.findCampaignById(campaign.id, req.user!.businessId)) ?? campaign;
  }

  res.status(201).json({ import: importRow, campaign, campaignResult });
});
