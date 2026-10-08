import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import {
  createLeadSchema,
  updateLeadSchema,
  leadQuerySchema,
  createNoteSchema,
  createActivitySchema,
  csvLeadRowSchema,
  mergeLeadsSchema,
  LEAD_SOURCES,
} from '../validation/schemas';
import * as leadRepo from '../repositories/leadRepo';
import * as noteRepo from '../repositories/noteRepo';
import * as activityRepo from '../repositories/activityRepo';
import * as followUpRepo from '../repositories/followUpRepo';
import { calculateLeadScore, priorityFromScore } from '../services/scoringService';
import { ForbiddenError, NotFoundError, BadRequestError } from '../utils/appError';
import { parseCsvToObjects, toCsv } from '../services/csvService';
import { intakeLead } from '../services/leadIntakeService';
import { computeSlaState } from '../services/slaService';

function withSlaState<T extends { sla_status: string; sla_due_at: string | null }>(lead: T): T & { sla_state: string } {
  return { ...lead, sla_state: computeSlaState(lead) };
}

function scopeForRole(req: Request): string | undefined {
  return req.user!.role === 'sales' ? req.user!.userId : undefined;
}

async function assertLeadAccess(req: Request, leadId: string) {
  const lead = await leadRepo.findLeadById(leadId, req.user!.businessId);
  if (!lead) throw new NotFoundError('Lead not found');
  if (req.user!.role === 'sales' && lead.assigned_user_id !== req.user!.userId) {
    throw new ForbiddenError('You do not have access to this lead');
  }
  return lead;
}

export const listLeads = asyncHandler(async (req: Request, res: Response) => {
  const filters = leadQuerySchema.parse(req.query);
  const { rows, total } = await leadRepo.listLeads(req.user!.businessId, {
    ...filters,
    restrictToUserId: scopeForRole(req),
  });
  res.json({
    leads: rows.map(withSlaState),
    pagination: { page: filters.page, pageSize: filters.pageSize, total, totalPages: Math.ceil(total / filters.pageSize) },
  });
});

export const getLead = asyncHandler(async (req: Request, res: Response) => {
  const lead = await assertLeadAccess(req, req.params.id);
  res.json({ lead: withSlaState(lead) });
});

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  const input = createLeadSchema.parse(req.body);

  // All lead creation — manual or otherwise — flows through the central
  // Lead Intake Service: scoring, duplicate detection, automatic assignment
  // (routing rules / round robin), SLA follow-up, and automation rules. An
  // explicit assignedUserId (including a sales user creating their own
  // lead) bypasses routing rules.
  const result = await intakeLead({
    businessId: req.user!.businessId,
    name: input.name,
    company: input.company,
    email: input.email || null,
    phone: input.phone,
    source: input.source,
    industry: input.industry,
    interestedIn: input.interestedIn,
    timeline: input.timeline,
    description: input.description,
    assignedUserId: input.assignedUserId ?? (req.user!.role === 'sales' ? req.user!.userId : null),
    externalSource: 'manual',
    actorUserId: req.user!.userId,
  });

  res.status(201).json({
    lead: withSlaState(result.lead),
    isDuplicate: result.isDuplicate,
    duplicateOfLeadId: result.duplicateOfLeadId,
  });
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  const existing = await assertLeadAccess(req, req.params.id);
  const input = updateLeadSchema.parse(req.body);

  if (req.user!.role === 'sales' && input.assignedUserId !== undefined && input.assignedUserId !== req.user!.userId) {
    throw new ForbiddenError('Sales users cannot reassign leads');
  }

  const merged = {
    timeline: input.timeline ?? existing.timeline,
    email: input.email ?? existing.email,
    phone: input.phone ?? existing.phone,
    source: input.source ?? existing.source,
    interestedIn: input.interestedIn ?? existing.interested_in,
    description: input.description ?? existing.description,
  };
  const score = calculateLeadScore(merged);
  const priority = priorityFromScore(score);

  let updated = await leadRepo.updateLead(req.params.id, req.user!.businessId, {
    ...input,
    email: input.email === '' ? null : input.email,
    score,
    priority,
  });
  if (!updated) throw new NotFoundError('Lead not found');

  if (input.status && input.status !== existing.status) {
    await activityRepo.createActivity({
      businessId: req.user!.businessId,
      leadId: updated.id,
      userId: req.user!.userId,
      type: 'Status changed',
      description: `Status changed from ${existing.status} to ${input.status}.`,
    });

    // First time this lead moves out of "New" counts as first contact for
    // response-time / SLA tracking.
    if (existing.status === 'New') {
      const withContact = await leadRepo.markFirstContact(updated.id, req.user!.businessId);
      if (withContact) updated = withContact;
    }
  }
  if (input.assignedUserId !== undefined && input.assignedUserId !== existing.assigned_user_id) {
    await activityRepo.createActivity({
      businessId: req.user!.businessId,
      leadId: updated.id,
      userId: req.user!.userId,
      type: 'Lead assigned',
      description: `Lead assignment was updated.`,
    });
  }

  res.json({ lead: withSlaState(updated) });
});

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== 'owner' && req.user!.role !== 'manager') {
    throw new ForbiddenError('Only owners and managers can delete leads');
  }
  const deleted = await leadRepo.deleteLead(req.params.id, req.user!.businessId);
  if (!deleted) throw new NotFoundError('Lead not found');
  res.status(204).send();
});

export const listNotes = asyncHandler(async (req: Request, res: Response) => {
  await assertLeadAccess(req, req.params.id);
  const notes = await noteRepo.listNotesForLead(req.params.id, req.user!.businessId);
  res.json({ notes });
});

export const createLeadNote = asyncHandler(async (req: Request, res: Response) => {
  const lead = await assertLeadAccess(req, req.params.id);
  const input = createNoteSchema.parse(req.body);
  const note = await noteRepo.createNote({
    businessId: req.user!.businessId,
    leadId: lead.id,
    userId: req.user!.userId,
    content: input.content,
  });
  await activityRepo.createActivity({
    businessId: req.user!.businessId,
    leadId: lead.id,
    userId: req.user!.userId,
    type: 'Note added',
    description: 'A note was added to this lead.',
  });
  res.status(201).json({ note });
});

export const listActivities = asyncHandler(async (req: Request, res: Response) => {
  await assertLeadAccess(req, req.params.id);
  const activities = await activityRepo.listActivitiesForLead(req.params.id, req.user!.businessId);
  res.json({ activities });
});

export const createLeadActivity = asyncHandler(async (req: Request, res: Response) => {
  const lead = await assertLeadAccess(req, req.params.id);
  const input = createActivitySchema.parse(req.body);
  const activity = await activityRepo.createActivity({
    businessId: req.user!.businessId,
    leadId: lead.id,
    userId: req.user!.userId,
    type: input.type,
    description: input.description,
  });
  res.status(201).json({ activity });
});

export const getLeadFollowUps = asyncHandler(async (req: Request, res: Response) => {
  await assertLeadAccess(req, req.params.id);
  const followUps = await followUpRepo.listFollowUpsForLead(req.params.id, req.user!.businessId);
  res.json({ followUps });
});

export const importLeads = asyncHandler(async (req: Request, res: Response) => {
  const csvText = (req.body?.csv as string) ?? '';
  if (!csvText.trim()) {
    throw new BadRequestError('No CSV content provided');
  }

  const rows = parseCsvToObjects(csvText);
  let imported = 0;
  const errors: Array<{ row: number; message: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const parsedRow = csvLeadRowSchema.safeParse(raw);
    if (!parsedRow.success) {
      errors.push({ row: i + 2, message: parsedRow.error.issues.map((iss) => iss.message).join('; ') });
      continue;
    }
    const data = parsedRow.data;
    const source = (LEAD_SOURCES as readonly string[]).includes(data.source) ? data.source : 'CSV';

    try {
      await intakeLead({
        businessId: req.user!.businessId,
        name: data.name,
        company: data.company || null,
        email: data.email || null,
        phone: data.phone || null,
        source,
        industry: data.industry || null,
        interestedIn: data.interested_in || null,
        timeline: data.timeline || null,
        description: data.description || null,
        externalSource: 'csv',
        actorUserId: req.user!.userId,
      });

      imported++;
    } catch (err) {
      errors.push({ row: i + 2, message: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  res.json({ imported, failed: errors.length, errors });
});

export const listDuplicates = asyncHandler(async (req: Request, res: Response) => {
  const duplicates = await leadRepo.listPendingDuplicates(req.user!.businessId);
  res.json({ duplicates });
});

export const mergeLeadsHandler = asyncHandler(async (req: Request, res: Response) => {
  const input = mergeLeadsSchema.parse(req.body);

  const [source, target] = await Promise.all([
    leadRepo.findLeadById(input.sourceLeadId, req.user!.businessId),
    leadRepo.findLeadById(input.targetLeadId, req.user!.businessId),
  ]);
  if (!source || !target) throw new NotFoundError('One or both leads were not found');

  await leadRepo.mergeLeads(source.id, target.id, req.user!.businessId);

  await activityRepo.createActivity({
    businessId: req.user!.businessId,
    leadId: target.id,
    userId: req.user!.userId,
    type: 'Lead merged',
    description: `Lead "${source.name}" was merged into this lead.`,
  });

  const updatedTarget = await leadRepo.findLeadById(target.id, req.user!.businessId);
  res.json({ lead: updatedTarget ? withSlaState(updatedTarget) : null });
});

export const exportLeads = asyncHandler(async (req: Request, res: Response) => {
  const { rows } = await leadRepo.listLeads(req.user!.businessId, {
    page: 1,
    pageSize: 100000,
    sortBy: 'created_at',
    sortDir: 'desc',
    restrictToUserId: scopeForRole(req),
  });

  const headers = ['name', 'company', 'email', 'phone', 'industry', 'interested_in', 'timeline', 'status', 'score', 'assigned_user_name', 'created_at'];
  const csv = toCsv(headers, rows as unknown as Array<Record<string, unknown>>);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-export.csv"');
  res.send(csv);
});
