import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createSequenceSchema, updateSequenceSchema } from '../validation/outreachSchemas';
import * as outreachSequenceRepo from '../repositories/outreachSequenceRepo';
import { NotFoundError, BadRequestError } from '../utils/appError';
import * as outreachCampaignRepo from '../repositories/outreachCampaignRepo';

async function withSteps(sequence: outreachSequenceRepo.SequenceRow) {
  const steps = await outreachSequenceRepo.listSteps(sequence.id);
  return { ...sequence, steps };
}

export const listSequences = asyncHandler(async (req: Request, res: Response) => {
  const sequences = await outreachSequenceRepo.listSequences(req.user!.businessId);
  res.json({ sequences: await Promise.all(sequences.map(withSteps)) });
});

export const getSequence = asyncHandler(async (req: Request, res: Response) => {
  const sequence = await outreachSequenceRepo.findSequenceById(req.params.id, req.user!.businessId);
  if (!sequence) throw new NotFoundError('Sequence not found');
  res.json({ sequence: await withSteps(sequence) });
});

export const createSequence = asyncHandler(async (req: Request, res: Response) => {
  const input = createSequenceSchema.parse(req.body);
  const sequence = await outreachSequenceRepo.createSequence({ businessId: req.user!.businessId, name: input.name, description: input.description });
  await outreachSequenceRepo.replaceSteps(sequence.id, input.steps);
  res.status(201).json({ sequence: await withSteps(sequence) });
});

export const updateSequence = asyncHandler(async (req: Request, res: Response) => {
  const existing = await outreachSequenceRepo.findSequenceById(req.params.id, req.user!.businessId);
  if (!existing) throw new NotFoundError('Sequence not found');

  const input = updateSequenceSchema.parse(req.body);
  const updated = await outreachSequenceRepo.updateSequence(req.params.id, req.user!.businessId, { name: input.name, description: input.description });
  if (input.steps) await outreachSequenceRepo.replaceSteps(req.params.id, input.steps);

  res.json({ sequence: await withSteps(updated ?? existing) });
});

export const deleteSequence = asyncHandler(async (req: Request, res: Response) => {
  const existing = await outreachSequenceRepo.findSequenceById(req.params.id, req.user!.businessId);
  if (!existing) throw new NotFoundError('Sequence not found');

  const campaigns = await outreachCampaignRepo.listCampaigns(req.user!.businessId);
  const inUse = campaigns.some((c) => c.sequence_id === req.params.id && !['cancelled', 'completed'].includes(c.status));
  if (inUse) throw new BadRequestError('This sequence is used by an active campaign — cancel or delete that campaign first');

  await outreachSequenceRepo.deleteSequence(req.params.id, req.user!.businessId);
  res.status(204).send();
});
