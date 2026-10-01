export type Role = 'owner' | 'sales' | 'developer';

export const LEAD_SOURCES = [
  'Website', 'WhatsApp', 'Facebook', 'Instagram', 'Phone', 'Referral', 'Other',
  'GoogleAds', 'Manual', 'CSV', 'API', 'Form', 'GoogleSheet',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const FOLLOW_UP_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Other'] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const LEAD_PRIORITIES = ['Low', 'Medium', 'High', 'Hot'] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export type SlaState = 'Pending' | 'DueSoon' | 'Overdue' | 'Met' | 'Missed';

export interface User {
  id: string;
  business_id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  business_id: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  industry: string | null;
  interested_in: string | null;
  budget: string | null;
  timeline: string | null;
  description: string | null;
  status: LeadStatus;
  score: number;
  priority: LeadPriority;
  created_at: string;
  updated_at: string;
  // Attribution
  source_detail: string | null;
  form_id: string | null;
  campaign_id: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  landing_page: string | null;
  referrer: string | null;
  external_source: string | null;
  // Duplicate detection
  duplicate_of_lead_id: string | null;
  merged_at: string | null;
  // SLA
  first_contact_at: string | null;
  response_time_seconds: number | null;
  sla_due_at: string | null;
  sla_status: 'Pending' | 'Met' | 'Missed';
  sla_state: SlaState;
}

export interface Activity {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name?: string | null;
  type: string;
  description: string;
  created_at: string;
}

export interface Note {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name?: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: string;
  business_id: string;
  lead_id: string;
  lead_name?: string;
  user_id: string | null;
  user_name?: string | null;
  type: FollowUpType;
  scheduled_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface AiQualification {
  id: string;
  lead_id: string;
  score: number;
  qualification: 'Hot' | 'Warm' | 'Cold';
  summary: string;
  reasoning: string;
  recommended_action: string;
  strengths: string | null;
  concerns: string | null;
  urgency: string | null;
  suggested_response: string | null;
  estimated_priority: LeadPriority | null;
  created_at: string;
}

export interface Quotation {
  id: string;
  lead_id: string;
  title: string;
  amount: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface DashboardData {
  kpis: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    wonDeals: number;
    lostDeals: number;
    conversionRate: number;
    followUpsDue: number;
    pipelineValue: number;
    unworkedLeads: number;
    slaComplianceRate: number;
    overdueLeads: number;
  };
  charts: {
    leadsByStatus: Array<{ status: string; count: number }>;
    leadsBySource: Array<{ source: string; count: number }>;
    leadsOverTime: Array<{ date: string; count: number }>;
    pipelineValueByStatus: Array<{ status: string; value: number }>;
  };
}

export interface ReportsData {
  totalLeads: number;
  conversionRate: number;
  won: number;
  lost: number;
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  pipelineValueByStatus: Array<{ status: string; value: number }>;
  salespersonPerformance: Array<{ userId: string; name: string; totalLeads: number; won: number; lost: number; pipelineValue: number }>;
  sourcePerformance: Array<{ source: string; totalLeads: number; qualified: number; won: number }>;
  sla: {
    avgResponseSeconds: number | null;
    slaMetCount: number;
    slaMissedCount: number;
    slaPendingCount: number;
    overdueCount: number;
    complianceRate: number;
  };
  campaignPerformance: Array<{ id: string; name: string; source: string | null; utm_campaign: string | null; total_leads: number; qualified: number; won: number; revenue: number }>;
}

export interface PipelineColumn {
  status: LeadStatus;
  leads: Lead[];
}

// ===========================================================
// Lead capture forms
// ===========================================================
export const FORM_FIELD_TYPES = ['text', 'email', 'phone', 'textarea', 'select', 'number'] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export interface LeadFormField {
  id?: string;
  name: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string | null;
  options?: string[] | null;
  sort_order?: number;
}

export interface LeadForm {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'Active' | 'Disabled';
  thank_you_message: string;
  created_at: string;
  updated_at: string;
  fields: LeadFormField[];
}

// ===========================================================
// Campaigns
// ===========================================================
export interface Campaign {
  id: string;
  name: string;
  source: string | null;
  utm_campaign: string | null;
  total_leads: number;
  qualified: number;
  won: number;
  revenue: number;
}

// ===========================================================
// Notifications
// ===========================================================
export interface Notification {
  id: string;
  business_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

// ===========================================================
// Lead routing
// ===========================================================
export interface RoutingRule {
  id: string;
  business_id: string;
  name: string;
  priority: number;
  field: 'source' | 'industry' | 'score' | 'always';
  operator: 'equals' | 'gte' | 'lte';
  value: string | null;
  assignment_type: 'user' | 'round_robin' | 'owner';
  assign_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlaSettings {
  business_id: string;
  hot_minutes: number;
  high_minutes: number;
  medium_minutes: number;
  low_minutes: number;
  updated_at: string;
}

// ===========================================================
// Automation rules
// ===========================================================
export interface AutomationCondition {
  field: 'score' | 'source' | 'industry';
  operator: 'equals' | 'gte' | 'lte';
  value: string;
}

export type AutomationAction =
  | { type: 'assign_user'; userId: string }
  | { type: 'create_followup'; followUpType: FollowUpType; minutes: number }
  | { type: 'notify'; userId?: string };

export interface AutomationRule {
  id: string;
  business_id: string;
  name: string;
  trigger_event: 'lead_created';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

// ===========================================================
// Integrations / webhooks / API keys
// ===========================================================
export interface WebhookInfo {
  id: string;
  secretPrefix: string;
  isActive: boolean;
  lastDeliveryAt: string | null;
  url: string;
}

export interface WebhookDelivery {
  id: string;
  status: 'Success' | 'Failed';
  payload: unknown;
  error: string | null;
  lead_id: string | null;
  created_at: string;
}

export interface IntegrationsOverview {
  webhook: WebhookInfo | null;
  meta: {
    status: 'Connected' | 'Disconnected';
    externalAccountId: string | null;
    hasCredentialsConfigured: boolean;
    webhookUrl: string;
  };
}

export interface ApiKey {
  id: string;
  business_id: string;
  name: string;
  key_prefix: string;
  created_by: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

// ===========================================================
// Outreach (outbound email automation)
// ===========================================================
export type OutreachContactStatus = 'active' | 'suppressed' | 'unsubscribed' | 'bounced' | 'do_not_contact';

export interface OutreachContact {
  id: string;
  business_id: string;
  sheet_import_id: string | null;
  lead_id: string | null;
  company_name: string | null;
  brand_name: string | null;
  contact_name: string | null;
  email: string;
  normalized_email: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  pain_points: string | null;
  possible_solution: string | null;
  notes: string | null;
  source: string;
  status: OutreachContactStatus;
  created_at: string;
  updated_at: string;
}

export interface SequenceStep {
  id?: string;
  sequence_id?: string;
  step_order: number;
  delay_days: number;
  subject_template: string;
  body_template: string | null;
  ai_personalize: boolean;
  is_enabled: boolean;
}

export interface OutreachSequence {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  steps: SequenceStep[];
  created_at: string;
  updated_at: string;
}

export type CampaignStatus = 'draft' | 'review' | 'approved' | 'running' | 'paused' | 'completed' | 'cancelled';

export interface OutreachCampaign {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  sender_name: string | null;
  sender_email: string | null;
  reply_to: string | null;
  sequence_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  contactCounts: Record<string, number>;
  created_at: string;
  updated_at: string;
}

export type CampaignContactStatus = 'pending' | 'drafted' | 'approved' | 'queued' | 'sent' | 'delivered' | 'bounced' | 'replied' | 'unsubscribed' | 'stopped' | 'failed';

export interface CampaignContact {
  id: string;
  business_id: string;
  campaign_id: string;
  contact_id: string;
  status: CampaignContactStatus;
  current_step: number;
  next_send_at: string | null;
  stopped_reason: string | null;
  failed_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface QualityIssue {
  code: string;
  severity: 'warning' | 'blocking';
  message: string;
}

export type DraftStatus = 'draft' | 'approved' | 'rejected' | 'sent';

export interface OutreachDraft {
  id: string;
  business_id: string;
  campaign_contact_id: string;
  step_order: number;
  subject: string;
  ai_raw_body: string;
  naturalized_body: string;
  final_body: string | null;
  quality_status: 'passed' | 'warnings' | 'blocked';
  quality_issues: QualityIssue[];
  status: DraftStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OutreachMessage {
  id: string;
  business_id: string;
  campaign_contact_id: string;
  draft_id: string | null;
  provider: string;
  provider_message_id: string | null;
  subject: string;
  body: string;
  status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
  sent_at: string | null;
  delivered_at: string | null;
  failed_reason: string | null;
  created_at: string;
}

export interface EmailReply {
  id: string;
  business_id: string;
  thread_id: string;
  contact_id: string;
  from_email: string;
  subject: string | null;
  body: string;
  classification: string;
  created_at: string;
}

export interface SheetImport {
  id: string;
  business_id: string;
  connection_id: string | null;
  source_type: 'sheet' | 'csv' | 'manual';
  status: 'Running' | 'Completed' | 'Failed';
  total_rows: number;
  imported_rows: number;
  duplicate_rows: number;
  failed_rows: number;
  errors: Array<{ row: number; message: string }>;
  created_at: string;
}

export interface Suppression {
  id: string;
  business_id: string;
  normalized_email: string;
  reason: 'unsubscribe' | 'bounce' | 'manual' | 'complaint' | 'wrong_contact';
  source: string | null;
  created_at: string;
}

export interface EmailSettings {
  business_id: string;
  default_sender_name: string | null;
  default_sender_email: string | null;
  default_reply_to: string | null;
  daily_send_limit: number;
  voice_description: string | null;
}

export interface OutreachProvidersOverview {
  email: { name: string; configured: boolean; selected: string };
  ai: { name: string; configured: boolean; selected: string };
  sheets: { name: string; configured: boolean; selected: string };
  inbound: { name: string; configured: boolean; selected: string };
}

// ===========================================================
// Developer/Admin Dashboard
// ===========================================================
export interface PlatformOverview {
  totalBusinesses: number;
  totalUsers: number;
  totalLeads: number;
  activeCampaigns: number;
  emailsSent: number;
  emailsQueued: number;
  repliesReceived: number;
  convertedLeads: number;
  failedEmails: number;
  suppressedContacts: number;
}

export interface TimeSeriesPoint {
  date: string;
  count: number;
}

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  user_count: number;
  lead_count: number;
  campaign_count: number;
  created_at: string;
}

export interface BusinessDetail extends BusinessSummary {
  email: string | null;
  phone: string | null;
  industry: string | null;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  is_active: boolean;
  created_at: string;
  business_id: string;
  business_name: string;
}

export interface PlatformLead {
  id: string;
  name: string;
  company: string | null;
  business_id: string;
  business_name: string;
  source: string;
  status: string;
  score: number;
  assigned_user_name: string | null;
  created_at: string;
}

export interface OutreachLifecycleStats {
  draft: number;
  approved: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  replied: number;
}

export interface RecentCampaignSummary {
  id: string;
  name: string;
  status: string;
  business_name: string;
  created_at: string;
}

export interface N8nExecutionLog {
  id: string;
  business_id: string | null;
  triggered_by: 'api_key' | 'jwt';
  status: 'success' | 'failure';
  drafts_generated: number;
  sent: number;
  blocked: number;
  failed: number;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface N8nSummary {
  lastExecutionAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalExecutions: number;
  apiKeyExecutionsLast24h: number;
}

export type HealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'not_configured';

export interface HealthServices {
  leadflowApi: { status: HealthStatus };
  database: { status: HealthStatus };
  n8n: { status: HealthStatus; detail: string };
  emailProvider: { status: HealthStatus; detail: string };
  aiProvider: { status: HealthStatus; detail: string };
  sheetsProvider: { status: HealthStatus; detail: string };
  inboundProvider: { status: HealthStatus; detail: string };
}

export interface SystemEvent {
  id: string;
  severity: 'info' | 'warning' | 'error';
  event_type: string;
  business_id: string | null;
  business_name: string | null;
  user_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DeveloperAuditLog {
  id: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  business_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  result: 'success' | 'failure';
  created_at: string;
}
