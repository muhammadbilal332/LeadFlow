import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createFollowUpSchema, updateFollowUpSchema } from '../validation/schemas';
import * as followUpRepo from '../repositories/followUpRepo';
import * as leadRepo from '../repositories/leadRepo';
import * as activityRepo from '../repositories/activityRepo';
import { ForbiddenError, NotFoundError } from '../utils/appError';

export const listFollowUps = asyncHandler(async (req: Request, res: Response) => {
  const status = (req.query.status as 'upcoming' | 'overdue' | 'completed' | 'all' | undefined) ?? 'all';
  const restrictToUserId = req.user!.role === 'sales' ? req.user!.userId : undefined;
  const followUps = await followUpRepo.listFollowUps(req.user!.businessId, { status, restrictToUserId });
  res.json({ followUps });
});

export const createFollowUp = asyncHandler(async (req: Request, res: Response) => {
  const input = createFollowUpSchema.parse(req.body);

  const lead = await leadRepo.findLeadById(input.leadId, req.user!.businessId);
  if (!lead) throw new NotFoundError('Lead not found');
  if (req.user!.role === 'sales' && lead.assigned_user_id !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this lead');
  }

  const followUp = await followUpRepo.createFollowUp({
    businessId: req.user!.businessId,
    leadId: input.leadId,
    userId: req.user!.userId,
    type: input.type,
    scheduledAt: new Date(input.scheduledAt).toISOString(),
    notes: input.notes,
  });

  await activityRepo.createActivity({
    businessId: req.user!.businessId,
    leadId: input.leadId,
    userId: req.user!.userId,
    type: 'Follow-up scheduled',
    description: `A ${input.type} follow-up was scheduled.`,
  });

  res.status(201).json({ followUp });
});

export const updateFollowUpHandler = asyncHandler(async (req: Request, res: Response) => {
  const existing = await followUpRepo.findFollowUpById(req.params.id, req.user!.businessId);
  if (!existing) throw new NotFoundError('Follow-up not found');
  if (req.user!.role === 'sales' && existing.user_id !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this follow-up');
  }

  const input = updateFollowUpSchema.parse(req.body);
  const updated = await followUpRepo.updateFollowUp(req.params.id, req.user!.businessId, {
    type: input.type,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt).toISOString() : undefined,
    notes: input.notes,
    completedAt: input.completed === true ? new Date().toISOString() : input.completed === false ? null : undefined,
  });

  if (input.completed === true) {
    await activityRepo.createActivity({
      businessId: req.user!.businessId,
      leadId: existing.lead_id,
      userId: req.user!.userId,
      type: `${existing.type} completed`,
      description: `A ${existing.type.toLowerCase()} follow-up was marked completed.`,
    });
  }

  res.json({ followUp: updated });
});
