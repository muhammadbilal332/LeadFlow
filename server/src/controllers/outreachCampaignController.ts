import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createCampaignSchema, updateCampaignSchema, addContactsToCampaignSchema } from '../validation/outreachSchemas';
import * as outreachCampaignRepo from '../repositories/outreachCampaignRepo';
import * as campaignContactRepo from '../repositories/campaignContactRepo';
import { generateDueDrafts, addContactsAndGenerateDrafts } from '../services/outreach/sequenceService';
import { runTick } from '../services/outreach/outreachQueueService';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { logAudit } from '../repositories/outreachAuditLogRepo';

async function withCounts(campaign: outreachCampaignRepo.OutreachCampaignRow) {
  const counts = await campaignContactRepo.countByCampaignAndStatus(campaign.id);
  return { ...campaign, contactCounts: counts };
}

export const listCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const campaigns = await outreachCampaignRepo.listCampaigns(req.user!.businessId);
  res.json({ campaigns: await Promise.all(campaigns.map(withCounts)) });
});

export const getCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');
  const contacts = await campaignContactRepo.listForCampaignWithFailureReason(campaign.id, req.user!.businessId);
  res.json({ campaign: await withCounts(campaign), contacts });
});

export const createCampaign = asyncHandler(async (req: Request, res: Response) => {
  const input = createCampaignSchema.parse(req.body);
  const campaign = await outreachCampaignRepo.createCampaign({
    businessId: req.user!.businessId,
    name: input.name,
    description: input.description,
    senderName: input.senderName,
    senderEmail: input.senderEmail || null,
    replyTo: input.replyTo || null,
    sequenceId: input.sequenceId,
    createdBy: req.user!.userId,
  });
  res.status(201).json({ campaign: await withCounts(campaign) });
});

export const updateCampaign = asyncHandler(async (req: Request, res: Response) => {
  const existing = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!existing) throw new NotFoundError('Campaign not found');
  if (existing.status !== 'draft') throw new BadRequestError('Only a draft campaign can be edited');

  const input = updateCampaignSchema.parse(req.body);
  const updated = await outreachCampaignRepo.updateCampaign(req.params.id, req.user!.businessId, {
    name: input.name,
    description: input.description,
    senderName: input.senderName,
    senderEmail: input.senderEmail || null,
    replyTo: input.replyTo || null,
    sequenceId: input.sequenceId,
  });
  res.json({ campaign: await withCounts(updated ?? existing) });
});

/** Adds contacts and immediately generates their first-step draft (if the campaign has a sequence) — no separate "Generate drafts" click needed for the common case. */
export const addContacts = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  const input = addContactsToCampaignSchema.parse(req.body);
  const { added, draftsGenerated } = await addContactsAndGenerateDrafts(req.user!.businessId, campaign, input.contactIds);

  const refreshed = await outreachCampaignRepo.findCampaignById(campaign.id, req.user!.businessId);
  res.json({ added, draftsGenerated, campaign: await withCounts(refreshed ?? campaign) });
});

/** Generates step-1 drafts for every contact just added — puts them in the Email Draft Review queue. Generates nothing that isn't reviewed by a human before it can send. */
export const generateDrafts = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (!campaign.sequence_id) throw new BadRequestError('Campaign has no sequence attached');

  if (campaign.status === 'draft') {
    await outreachCampaignRepo.setStatus(campaign.id, req.user!.businessId, 'review');
  }

  const generated = await generateDueDrafts(req.user!.businessId);
  res.json({ generated });
});

/** Campaign-level approval gate — required before a campaign can ever be started. Mirrors per-draft approval, which additionally gates every individual send. */
export const approveCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (!['draft', 'review'].includes(campaign.status)) throw new BadRequestError('Only a draft or in-review campaign can be approved');

  const approved = await outreachCampaignRepo.approve(campaign.id, req.user!.businessId, req.user!.userId);
  await logAudit({ businessId: req.user!.businessId, actorUserId: req.user!.userId, action: 'campaign_approved', entityType: 'outreach_campaign', entityId: campaign.id });
  res.json({ campaign: approved });
});

/** Starts the campaign and immediately runs one processing cycle — any already-approved draft sends right away instead of waiting for a separate "Process queue" action or the next scheduled n8n tick. */
export const startCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');
  if (campaign.status !== 'approved' && campaign.status !== 'paused') {
    throw new BadRequestError('Campaign must be approved before it can start');
  }

  const started = await outreachCampaignRepo.setStatus(campaign.id, req.user!.businessId, 'running');
  await logAudit({ businessId: req.user!.businessId, actorUserId: req.user!.userId, action: 'campaign_started', entityType: 'outreach_campaign', entityId: campaign.id });

  const tickResult = await runTick(req.user!.businessId);

  res.json({ campaign: started, tickResult });
});

export const pauseCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  const paused = await outreachCampaignRepo.setStatus(campaign.id, req.user!.businessId, 'paused');
  res.json({ campaign: paused });
});

export const cancelCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await outreachCampaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  const cancelled = await outreachCampaignRepo.setStatus(campaign.id, req.user!.businessId, 'cancelled');
  res.json({ campaign: cancelled });
});

export const deleteCampaign = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await outreachCampaignRepo.deleteCampaign(req.params.id, req.user!.businessId);
  if (!deleted) throw new NotFoundError('Campaign not found');
  res.status(204).send();
});
