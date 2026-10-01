import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { automationRuleSchema, updateAutomationRuleSchema } from '../validation/schemas';
import * as automationRepo from '../repositories/automationRuleRepo';
import { NotFoundError } from '../utils/appError';

export const listAutomationRules = asyncHandler(async (req: Request, res: Response) => {
  const rules = await automationRepo.listAutomationRules(req.user!.businessId);
  res.json({ rules });
});

export const createAutomationRule = asyncHandler(async (req: Request, res: Response) => {
  const input = automationRuleSchema.parse(req.body);
  const rule = await automationRepo.createAutomationRule({
    businessId: req.user!.businessId,
    name: input.name,
    conditions: input.conditions,
    actions: input.actions,
    priority: input.priority,
  });
  res.status(201).json({ rule });
});

export const updateAutomationRule = asyncHandler(async (req: Request, res: Response) => {
  const input = updateAutomationRuleSchema.parse(req.body);
  const rule = await automationRepo.updateAutomationRule(req.params.id, req.user!.businessId, input);
  if (!rule) throw new NotFoundError('Automation rule not found');
  res.json({ rule });
});

export const deleteAutomationRule = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await automationRepo.deleteAutomationRule(req.params.id, req.user!.businessId);
  if (!deleted) throw new NotFoundError('Automation rule not found');
  res.status(204).send();
});
