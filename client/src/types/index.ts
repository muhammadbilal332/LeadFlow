export type Role = 'owner' | 'sales' | 'manager' | 'developer';

export const LEAD_SOURCES = [
  'Website', 'WhatsApp', 'Facebook', 'Instagram', 'Phone', 'Referral', 'Other',
  'GoogleAds', 'Manual', 'CSV', 'API', 'Form', 'GoogleSheet',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ['New', 'Contacted', 'Replied', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
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
  linkedin_url: string | null;
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

export interface SalespersonPerformance {
  userId: string;
  name: string;
  role: string;
  newLeads: number;
  won: number;
  lost: number;
  conversionRate: number;
  emailsSent: number;
  repliesReceived: number;
}

export const PERFORMANCE_PERIODS = [
  { value: 'day', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
] as const;
export type PerformancePeriod = (typeof PERFORMANCE_PERIODS)[number]['value'];

export interface PersonEmail {
  id: string;
  subject: string;
  body: string;
  status: string;
  sent_at: string | null;
  failed_reason: string | null;
  thread_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  lead_id: string | null;
  reply_count?: number;
}

export interface EmailReplyItem {
  id: string;
  from_email: string;
  subject: string | null;
  body: string;
  classification: string;
  created_at: string;
}

export interface DashboardData {
  salespeople: SalespersonPerformance[];
  kpis: {
    totalLeads: number;
    newLeads: number;
    qualifiedLeads: number;
    wonDeals: number;
    lostDeals: number;
    conversionRate: number;
    followUpsDue: number;
    unworkedLeads: number;
    slaComplianceRate: number;
    overdueLeads: number;
  };
  charts: {
    leadsByStatus: Array<{ status: string; count: number }>;
    leadsBySource: Array<{ source: string; count: number }>;
    leadsOverTime: Array<{ date: string; count: number }>;
  };
}

export interface ReportsData {
  totalLeads: number;
  conversionRate: number;
  won: number;
  lost: number;
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  salespersonPerformance: Array<{ userId: string; name: string; totalLeads: number; won: number; lost: number }>;
  sourcePerformance: Array<{ source: string; totalLeads: number; qualified: number; won: number }>;
  sla: {
    avgResponseSeconds: number | null;
    slaMetCount: number;
    slaMissedCount: number;
    slaPendingCount: number;
    overdueCount: number;
    complianceRate: number;
  };
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
  /** The linked CRM lead's current status (e.g. 'New', 'Contacted') — null when this contact isn't linked to a lead. */
  lead_status?: string | null;
  /** Whether this contact has ever actually been emailed (sent/delivered/bounced), from the Contacts list only. */
  has_sent_message?: boolean;
  /** Set when a reply-free follow-up step is due right now, from the Contacts list only. */
  follow_up_due?: { campaign_contact_id: string; bucket: string; has_draft: boolean } | null;
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
  recipient_name?: string | null;
  recipient_email?: string;
  company_name?: string | null;
  lead_id?: string | null;
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
  is_read: boolean;
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

export interface AutomationExecutionLog {
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

export interface AutomationSummary {
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
  scheduler: { status: HealthStatus; detail: string };
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

// ===========================================================
// CRM upgrade: email threading, follow-up queue, Sent/Inbox
// ===========================================================
export interface ConversationMessage {
  direction: 'outgoing' | 'incoming';
  id: string;
  subject: string | null;
  body: string;
  status?: string;
  classification?: string;
  at: string;
}

export interface EmailThreadWithConversation {
  id: string;
  subject: string | null;
  createdAt: string;
  lastActivityAt: string;
  conversation: ConversationMessage[];
}

export interface LeadEmailHistory {
  contact: OutreachContact | null;
  threads: EmailThreadWithConversation[];
  followUpStatus: FollowUpStatus;
}

export interface FollowUpStatus {
  label: string;
  state: 'none' | 'not_sent' | 'pending' | 'overdue' | 'sent' | 'stopped' | 'completed';
  dueAt: string | null;
}

export interface ComposeEmailResult {
  draft: OutreachDraft;
  campaignContactId: string;
  stepOrder: number;
}

export type FollowUpQueueBucket = '3-day' | '7-day' | '14-day' | '28-day' | 'overdue';

export interface FollowUpQueueItem {
  campaign_contact_id: string;
  campaign_id: string;
  contact_id: string;
  lead_id: string;
  lead_name: string;
  company: string | null;
  lead_status: string;
  assigned_user_id: string | null;
  assigned_user_name: string | null;
  current_step: number;
  next_step_order: number;
  next_send_at: string;
  cc_status: string;
  has_draft: boolean;
  days_past_due: number;
  bucket: FollowUpQueueBucket;
}

export interface InboxReply extends EmailReply {
  contact_name: string | null;
  lead_id: string | null;
  lead_name: string | null;
}

export interface SentMessage extends OutreachMessage {
  recipient_email: string;
  recipient_name: string | null;
  lead_id: string | null;
  campaign_name: string;
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
