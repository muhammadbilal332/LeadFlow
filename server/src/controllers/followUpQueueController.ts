import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { listFollowUpQueue, FollowUpBucket } from '../services/outreach/followUpQueueService';
import { generateDraftForStep } from '../services/outreach/sequenceService';
import * as campaignContactRepo from '../repositories/campaignContactRepo';
import * as outreachDraftRepo from '../repositories/outreachDraftRepo';
import { NotFoundError } from '../utils/appError';

const BUCKETS: FollowUpBucket[] = ['3-day', '7-day', '14-day', '28-day', 'overdue'];

/**
 * The Follow-Ups page's "morning work queue": every lead-linked follow-up
 * step that's due or about to be, grouped into the 3/7/14/28-day + Overdue
 * tabs the spec asks for. Sales users only see leads assigned to them;
 * owner/manager see every team lead's queue.
 */
export const getFollowUpQueue = asyncHandler(async (req: Request, res: Response) => {
  const restrictToUserId = req.user!.role === 'sales' ? req.user!.userId : undefined;
  const items = await listFollowUpQueue(req.user!.businessId, restrictToUserId);

  const queue: Record<FollowUpBucket, typeof items> = { '3-day': [], '7-day': [], '14-day': [], '28-day': [], overdue: [] };
  for (const item of items) queue[item.bucket].push(item);

  res.json({
    queue,
    counts: Object.fromEntries(BUCKETS.map((b) => [b, queue[b].length])),
  });
});

/** Generates (or returns the existing) draft for a due follow-up step, for the Follow-Ups queue's review-and-send flow. */
export const generateFollowUpDraft = asyncHandler(async (req: Request, res: Response) => {
  const cc = await campaignContactRepo.findById(req.params.campaignContactId, req.user!.businessId);
  if (!cc) throw new NotFoundError('Follow-up not found');

  const existing = (await outreachDraftRepo.listForCampaignContact(cc.id)).find(
    (d) => d.step_order === cc.current_step + 1 && d.status === 'draft'
  );
  if (existing) {
    res.json({ draft: existing });
    return;
  }

  const draft = await generateDraftForStep(cc);
  res.status(201).json({ draft });
});
