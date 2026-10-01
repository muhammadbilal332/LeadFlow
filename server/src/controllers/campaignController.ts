import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as campaignRepo from '../repositories/campaignRepo';
import * as leadRepo from '../repositories/leadRepo';
import { NotFoundError } from '../utils/appError';

export const listCampaigns = asyncHandler(async (req: Request, res: Response) => {
  const performance = await campaignRepo.campaignPerformance(req.user!.businessId);
  res.json({ campaigns: performance });
});

export const getCampaign = asyncHandler(async (req: Request, res: Response) => {
  const campaign = await campaignRepo.findCampaignById(req.params.id, req.user!.businessId);
  if (!campaign) throw new NotFoundError('Campaign not found');

  const { rows, total } = await leadRepo.listLeads(req.user!.businessId, {
    page: 1,
    pageSize: 200,
    campaignId: campaign.id,
    sortBy: 'created_at',
    sortDir: 'desc',
  });

  res.json({ campaign, leads: rows, totalLeads: total });
});
