import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { updateDraftSchema } from '../validation/outreachSchemas';
import * as outreachDraftRepo from '../repositories/outreachDraftRepo';
import * as campaignContactRepo from '../repositories/campaignContactRepo';
import * as outreachContactRepo from '../repositories/outreachContactRepo';
import * as leadRepo from '../repositories/leadRepo';
import { onDraftApproved, onDraftRejected, generateDraftForStep } from '../services/outreach/sequenceService';
import { sendOneApprovedDraft } from '../services/outreach/outreachQueueService';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/appError';
import { logAudit } from '../repositories/outreachAuditLogRepo';
import { OutreachDraftRow } from '../repositories/outreachDraftRepo';

/** A sales user may only act on a draft addressed to a contact whose linked lead is assigned to them. */
async function assertDraftAccess(req: Request, draft: OutreachDraftRow): Promise<void> {
  if (req.user!.role !== 'sales') return;

  const cc = await campaignContactRepo.findById(draft.campaign_contact_id, req.user!.businessId);
  const contact = cc ? await outreachContactRepo.findById(cc.contact_id, req.user!.businessId) : null;
  const lead = contact?.lead_id ? await leadRepo.findLeadById(contact.lead_id, req.user!.businessId) : null;
  if (!lead || lead.assigned_user_id !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this draft');
  }
}

export const listDrafts = asyncHandler(async (req: Request, res: Response) => {
  const { campaignId } = req.query as Record<string, string | undefined>;
  const restrictToUserId = req.user!.role === 'sales' ? req.user!.userId : undefined;
  const drafts = await outreachDraftRepo.listPendingReview(req.user!.businessId, campaignId, restrictToUserId);
  res.json({ drafts });
});

export const getDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await outreachDraftRepo.findById(req.params.id, req.user!.businessId);
  if (!draft) throw new NotFoundError('Draft not found');
  await assertDraftAccess(req, draft);
  res.json({ draft });
});

export const updateDraft = asyncHandler(async (req: Request, res: Response) => {
  const existing = await outreachDraftRepo.findById(req.params.id, req.user!.businessId);
  if (!existing) throw new NotFoundError('Draft not found');
  await assertDraftAccess(req, existing);
  if (existing.status !== 'draft') throw new BadRequestError('Only a pending draft can be edited');

  const input = updateDraftSchema.parse(req.body);
  const updated = await outreachDraftRepo.updateContent(req.params.id, req.user!.businessId, input);
  res.json({ draft: updated });
});

/**
 * Approves a draft and, if its campaign is already running (e.g. an
 * auto-pilot campaign from a sheet import, or one a human already
 * started), sends it immediately rather than waiting for the next
 * scheduled tick — so "approve" and "send" happen in one action.
 */
export const approveDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await outreachDraftRepo.findById(req.params.id, req.user!.businessId);
  if (!draft) throw new NotFoundError('Draft not found');
  await assertDraftAccess(req, draft);
  if (draft.status !== 'draft') throw new BadRequestError('Only a pending draft can be approved');
  if (draft.quality_status === 'blocked') throw new BadRequestError('This draft failed quality checks and cannot be approved until fixed');

  await outreachDraftRepo.setStatus(req.params.id, req.user!.businessId, 'approved', { approvedBy: req.user!.userId });
  await onDraftApproved(draft.campaign_contact_id);
  await logAudit({ businessId: req.user!.businessId, actorUserId: req.user!.userId, action: 'draft_approved', entityType: 'outreach_draft', entityId: draft.id });

  const sendOutcome = await sendOneApprovedDraft(req.user!.businessId, draft.campaign_contact_id);
  const final = await outreachDraftRepo.findById(req.params.id, req.user!.businessId);

  res.json({ draft: final, sendOutcome });
});

export const rejectDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await outreachDraftRepo.findById(req.params.id, req.user!.businessId);
  if (!draft) throw new NotFoundError('Draft not found');
  await assertDraftAccess(req, draft);

  const rejected = await outreachDraftRepo.setStatus(req.params.id, req.user!.businessId, 'rejected');
  await onDraftRejected(draft.campaign_contact_id);
  res.json({ draft: rejected });
});

export const regenerateDraft = asyncHandler(async (req: Request, res: Response) => {
  const draft = await outreachDraftRepo.findById(req.params.id, req.user!.businessId);
  if (!draft) throw new NotFoundError('Draft not found');
  await assertDraftAccess(req, draft);
  if (draft.status !== 'draft') throw new BadRequestError('Only a pending draft can be regenerated');

  const cc = await campaignContactRepo.findById(draft.campaign_contact_id, req.user!.businessId);
  if (!cc) throw new NotFoundError('Campaign contact not found');

  await outreachDraftRepo.setStatus(draft.id, req.user!.businessId, 'rejected');
  const newDraft = await generateDraftForStep(cc);
  res.json({ draft: newDraft });
});
