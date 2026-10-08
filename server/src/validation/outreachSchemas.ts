import { z } from 'zod';

export const createContactSchema = z.object({
  companyName: z.string().trim().max(200).optional().nullable(),
  brandName: z.string().trim().max(200).optional().nullable(),
  contactName: z.string().trim().max(200).optional().nullable(),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  website: z.string().trim().max(300).optional().nullable(),
  industry: z.string().trim().max(200).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  painPoints: z.string().trim().max(2000).optional().nullable(),
  possibleSolution: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const sequenceStepSchema = z.object({
  stepOrder: z.number().int().min(1),
  delayDays: z.number().int().min(0).max(60),
  subjectTemplate: z.string().trim().min(1).max(300),
  bodyTemplate: z.string().trim().max(5000).optional().nullable(),
  aiPersonalize: z.boolean().optional().default(true),
  isEnabled: z.boolean().optional().default(true),
});

export const createSequenceSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  steps: z.array(sequenceStepSchema).min(1, 'At least one sequence step is required').max(10),
});

export const updateSequenceSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  steps: z.array(sequenceStepSchema).min(1).max(10).optional(),
});

export const updateDraftSchema = z.object({
  subject: z.string().trim().min(1).max(300).optional(),
  finalBody: z.string().trim().min(1).max(5000).optional(),
});

export const runImportSchema = z.object({
  connectionId: z.string().uuid().optional().nullable(),
  /** When set, every contact this import run touched is added to this campaign and drafted immediately. */
  campaignId: z.string().uuid().optional().nullable(),
  /** When true, skips auto-pilot campaign creation even if no campaignId is given — contacts are only imported, nothing else. Defaults to false, since auto-pilot is the default "import and go" behavior. */
  skipAutoCampaign: z.boolean().optional().default(false),
});

export const sheetConnectionSchema = z.object({
  name: z.string().trim().min(1).max(200),
  spreadsheetId: z.string().trim().max(300).optional().nullable(),
  sheetRange: z.string().trim().max(100).optional().default('Sheet1'),
  columnMapping: z.record(z.string(), z.string()).optional().default({}),
});

export const emailSettingsSchema = z.object({
  defaultSenderName: z.string().trim().max(200).optional().nullable(),
  defaultSenderEmail: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
  defaultReplyTo: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
  dailySendLimit: z.coerce.number().int().min(1).max(10000).optional(),
  voiceDescription: z.string().trim().max(1000).optional().nullable(),
});

export const addSuppressionSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  reason: z.enum(['unsubscribe', 'bounce', 'manual', 'complaint', 'wrong_contact']).default('manual'),
});

export const simulateReplySchema = z.object({
  fromEmail: z.string().trim().toLowerCase().email('Invalid email address'),
  body: z.string().trim().min(1).max(5000),
  subject: z.string().trim().max(300).optional(),
});
