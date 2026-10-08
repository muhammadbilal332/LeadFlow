import { z } from 'zod';

export const LEAD_SOURCES = [
  'Website', 'WhatsApp', 'Facebook', 'Instagram', 'Phone', 'Referral', 'Other',
  'GoogleAds', 'Manual', 'CSV', 'API', 'Form', 'GoogleSheet',
] as const;
export const LEAD_STATUSES = ['New', 'Contacted', 'Replied', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
export const FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Other'] as const;
export const QUOTATION_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'] as const;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createLeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  company: z.string().trim().max(200).optional().nullable(),
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  source: z.enum(LEAD_SOURCES).default('Other'),
  industry: z.string().trim().max(200).optional().nullable(),
  interestedIn: z.string().trim().max(500).optional().nullable(),
  timeline: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  linkedinUrl: z.string().trim().max(500).optional().nullable(),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  company: z.string().trim().max(200).optional().nullable(),
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  source: z.enum(LEAD_SOURCES).optional(),
  industry: z.string().trim().max(200).optional().nullable(),
  interestedIn: z.string().trim().max(500).optional().nullable(),
  timeline: z.string().trim().max(200).optional().nullable(),
  description: z.string().trim().max(5000).optional().nullable(),
  assignedUserId: z.string().uuid().optional().nullable(),
  status: z.enum(LEAD_STATUSES).optional(),
  linkedinUrl: z.string().trim().max(500).optional().nullable(),
});

export const leadQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedUserId: z.string().uuid().optional(),
  minScore: z.coerce.number().int().min(0).max(100).optional(),
  maxScore: z.coerce.number().int().min(0).max(100).optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Hot']).optional(),
  slaStatus: z.enum(['Pending', 'Met', 'Missed']).optional(),
  unworkedOnly: z.coerce.boolean().optional(),
  sortBy: z.enum(['created_at', 'name', 'score', 'status', 'company']).default('created_at'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const createNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note content is required').max(5000),
});

export const createActivitySchema = z.object({
  type: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(1000),
});

export const createFollowUpSchema = z.object({
  leadId: z.string().uuid('A valid lead is required'),
  type: z.enum(FOLLOW_UP_TYPES).default('Call'),
  scheduledAt: z.string().datetime({ offset: true }).or(z.string().min(1)),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateFollowUpSchema = z.object({
  type: z.enum(FOLLOW_UP_TYPES).optional(),
  scheduledAt: z.string().min(1).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
  completed: z.boolean().optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
  role: z.enum(['owner', 'sales', 'manager']).default('sales'),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  isActive: z.boolean().optional(),
});

export const updateBusinessSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  industry: z.string().trim().max(200).optional().nullable(),
});

export const createQuotationSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  amount: z.coerce.number().nonnegative(),
  status: z.enum(QUOTATION_STATUSES).default('Draft'),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const updateQuotationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  status: z.enum(QUOTATION_STATUSES).optional(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

// ===========================================================
// Lead capture forms
// ===========================================================
export const FORM_FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select', 'number'] as const;

export const formFieldSchema = z.object({
  name: z.string().trim().min(1).max(60).regex(/^[a-z0-9_]+$/i, 'Field name may only contain letters, numbers, and underscores'),
  label: z.string().trim().min(1).max(120),
  type: z.enum(FORM_FIELD_TYPES),
  required: z.boolean().optional().default(false),
  placeholder: z.string().trim().max(200).optional().nullable(),
  options: z.array(z.string().trim().min(1).max(100)).max(30).optional().nullable(),
});

export const createFormSchema = z.object({
  name: z.string().trim().min(1, 'Form name is required').max(200),
  slug: z.string().trim().max(80).regex(/^[a-z0-9-]*$/i, 'Slug may only contain letters, numbers, and hyphens').optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  thankYouMessage: z.string().trim().max(1000).optional(),
  fields: z.array(formFieldSchema).max(20).default([]),
});

export const updateFormSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  thankYouMessage: z.string().trim().max(1000).optional(),
  status: z.enum(['Active', 'Disabled']).optional(),
  fields: z.array(formFieldSchema).max(20).optional(),
});

/** Public form submission body: known contact fields plus arbitrary custom field values keyed by field name. */
export const publicFormSubmissionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional(),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
  fields: z.record(z.string(), z.union([z.string(), z.number()])).optional().default({}),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  utmTerm: z.string().trim().max(200).optional(),
  utmContent: z.string().trim().max(200).optional(),
  landingPage: z.string().trim().max(500).optional(),
  referrer: z.string().trim().max(500).optional(),
});

// ===========================================================
// Lead routing rules
// ===========================================================
export const routingRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
  field: z.enum(['source', 'industry', 'score', 'always']),
  operator: z.enum(['equals', 'gte', 'lte']),
  value: z.string().trim().max(200).optional().nullable(),
  assignmentType: z.enum(['user', 'round_robin', 'owner']),
  assignUserId: z.string().uuid().optional().nullable(),
}).refine((d) => d.assignmentType !== 'user' || Boolean(d.assignUserId), {
  message: 'assignUserId is required when assignmentType is "user"',
  path: ['assignUserId'],
});

export const updateRoutingRuleSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  field: z.enum(['source', 'industry', 'score', 'always']).optional(),
  operator: z.enum(['equals', 'gte', 'lte']).optional(),
  value: z.string().trim().max(200).optional().nullable(),
  assignmentType: z.enum(['user', 'round_robin', 'owner']).optional(),
  assignUserId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const slaSettingsSchema = z.object({
  hotMinutes: z.coerce.number().int().min(1).max(10080).optional(),
  highMinutes: z.coerce.number().int().min(1).max(10080).optional(),
  mediumMinutes: z.coerce.number().int().min(1).max(10080).optional(),
  lowMinutes: z.coerce.number().int().min(1).max(10080).optional(),
});

// ===========================================================
// Automation rules
// ===========================================================
const automationConditionSchema = z.object({
  field: z.enum(['score', 'source', 'industry']),
  operator: z.enum(['equals', 'gte', 'lte']),
  value: z.string().trim().min(1).max(200),
});

const automationActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('assign_user'), userId: z.string().uuid() }),
  z.object({ type: z.literal('create_followup'), followUpType: z.enum(FOLLOW_UP_TYPES), minutes: z.coerce.number().int().min(1).max(10080) }),
  z.object({ type: z.literal('notify'), userId: z.string().uuid().optional() }),
]);

export const automationRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  conditions: z.array(automationConditionSchema).max(10).default([]),
  actions: z.array(automationActionSchema).min(1).max(10),
  priority: z.coerce.number().int().min(0).max(1000).default(0),
});

export const updateAutomationRuleSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  conditions: z.array(automationConditionSchema).max(10).optional(),
  actions: z.array(automationActionSchema).min(1).max(10).optional(),
  priority: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
});

// ===========================================================
// Merge
// ===========================================================
export const mergeLeadsSchema = z.object({
  sourceLeadId: z.string().uuid(),
  targetLeadId: z.string().uuid(),
}).refine((d) => d.sourceLeadId !== d.targetLeadId, { message: 'Cannot merge a lead into itself', path: ['targetLeadId'] });

// ===========================================================
// Generic webhook (n8n / API) lead intake
// ===========================================================
export const webhookLeadSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.union([z.string().trim().toLowerCase().email(), z.literal('')]).optional(),
  phone: z.string().trim().max(50).optional(),
  company: z.string().trim().max(200).optional(),
  message: z.string().trim().max(5000).optional(),
  source: z.string().trim().max(50).optional(),
  campaign: z.string().trim().max(200).optional(),
  utm_source: z.string().trim().max(200).optional(),
  utm_medium: z.string().trim().max(200).optional(),
  utm_campaign: z.string().trim().max(200).optional(),
  utm_term: z.string().trim().max(200).optional(),
  utm_content: z.string().trim().max(200).optional(),
});

// ===========================================================
// API keys
// ===========================================================
export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export const csvLeadRowSchema = z.object({
  name: z.string().trim().min(1),
  company: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  phone: z.string().trim().optional().default(''),
  source: z.string().trim().optional().default('Other'),
  industry: z.string().trim().optional().default(''),
  interested_in: z.string().trim().optional().default(''),
  timeline: z.string().trim().optional().default(''),
  description: z.string().trim().optional().default(''),
});
