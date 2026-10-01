import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { routingRuleSchema, updateRoutingRuleSchema, slaSettingsSchema } from '../validation/schemas';
import * as routingRepo from '../repositories/routingRuleRepo';
import { NotFoundError } from '../utils/appError';

export const listRoutingRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await routingRepo.listRoutingRules(req.user!.businessId);
  res.json({ rules });
});

export const createRoutingRule = asyncHandler(async (req: Request, res: Response) => {
  const input = routingRuleSchema.parse(req.body);
  const rule = await routingRepo.createRoutingRule({
    businessId: req.user!.businessId,
    name: input.name,
    priority: input.priority,
    field: input.field,
    operator: input.operator,
    value: input.value,
    assignmentType: input.assignmentType,
    assignUserId: input.assignUserId,
  });
  res.status(201).json({ rule });
});

export const updateRoutingRule = asyncHandler(async (req: Request, res: Response) => {
  const input = updateRoutingRuleSchema.parse(req.body);
  const rule = await routingRepo.updateRoutingRule(req.params.id, req.user!.businessId, input);
  if (!rule) throw new NotFoundError('Routing rule not found');
  res.json({ rule });
});

export const deleteRoutingRule = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await routingRepo.deleteRoutingRule(req.params.id, req.user!.businessId);
  if (!deleted) throw new NotFoundError('Routing rule not found');
  res.status(204).send();
});

export const getSlaSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await routingRepo.getSlaSettings(req.user!.businessId);
  res.json({ settings });
});

export const updateSlaSettings = asyncHandler(async (req: Request, res: Response) => {
  const input = slaSettingsSchema.parse(req.body);
  const settings = await routingRepo.upsertSlaSettings(req.user!.businessId, input);
  res.json({ settings });
});
