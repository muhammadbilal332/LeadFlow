import { apiRequest } from '../lib/api';
import {
  OutreachContact, OutreachSequence, SequenceStep, OutreachCampaign, CampaignContact,
  OutreachDraft, OutreachMessage, EmailReply, SheetImport, Suppression, EmailSettings,
  OutreachProvidersOverview,
} from '../types';

// --- Contacts ---
export function listContacts(params: { search?: string; status?: string; page?: number } = {}): Promise<{ contacts: OutreachContact[]; total: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  const query = qs.toString();
  return apiRequest(`/outreach/contacts${query ? `?${query}` : ''}`);
}

export function createContact(input: Partial<OutreachContact> & { email: string }): Promise<{ contact: OutreachContact; created: boolean }> {
  return apiRequest('/outreach/contacts', { method: 'POST', body: input });
}

export function deleteContact(id: string): Promise<void> {
  return apiRequest(`/outreach/contacts/${id}`, { method: 'DELETE' });
}

// --- Sequences ---
export function listSequences(): Promise<{ sequences: OutreachSequence[] }> {
  return apiRequest('/outreach/sequences');
}

function stepToWireFormat(step: SequenceStep) {
  return {
    stepOrder: step.step_order,
    delayDays: step.delay_days,
    subjectTemplate: step.subject_template,
    bodyTemplate: step.body_template,
    aiPersonalize: step.ai_personalize,
    isEnabled: step.is_enabled,
  };
}

export function createSequence(input: { name: string; description?: string | null; steps: SequenceStep[] }): Promise<{ sequence: OutreachSequence }> {
  return apiRequest('/outreach/sequences', { method: 'POST', body: { ...input, steps: input.steps.map(stepToWireFormat) } });
}

export function updateSequence(id: string, input: { name?: string; description?: string | null; steps?: SequenceStep[] }): Promise<{ sequence: OutreachSequence }> {
  return apiRequest(`/outreach/sequences/${id}`, { method: 'PATCH', body: { ...input, steps: input.steps?.map(stepToWireFormat) } });
}

export function deleteSequence(id: string): Promise<void> {
  return apiRequest(`/outreach/sequences/${id}`, { method: 'DELETE' });
}

// --- Campaigns ---
export function listCampaigns(): Promise<{ campaigns: OutreachCampaign[] }> {
  return apiRequest('/outreach/campaigns');
}

export function getCampaign(id: string): Promise<{ campaign: OutreachCampaign; contacts: CampaignContact[] }> {
  return apiRequest(`/outreach/campaigns/${id}`);
}

export function createCampaign(input: { name: string; description?: string | null; senderName?: string | null; senderEmail?: string | null; replyTo?: string | null; sequenceId?: string | null }): Promise<{ campaign: OutreachCampaign }> {
  return apiRequest('/outreach/campaigns', { method: 'POST', body: input });
}

export function updateCampaign(id: string, input: Partial<{ name: string; description: string | null; senderName: string | null; senderEmail: string | null; replyTo: string | null; sequenceId: string | null }>): Promise<{ campaign: OutreachCampaign }> {
  return apiRequest(`/outreach/campaigns/${id}`, { method: 'PATCH', body: input });
}

export function addContactsToCampaign(id: string, contactIds: string[]): Promise<{ added: number; draftsGenerated: number }> {
  return apiRequest(`/outreach/campaigns/${id}/contacts`, { method: 'POST', body: { contactIds } });
}

export function generateDrafts(id: string): Promise<{ generated: number }> {
  return apiRequest(`/outreach/campaigns/${id}/generate-drafts`, { method: 'POST' });
}

export function approveCampaign(id: string): Promise<{ campaign: OutreachCampaign }> {
  return apiRequest(`/outreach/campaigns/${id}/approve`, { method: 'POST' });
}

export function startCampaign(id: string): Promise<{ campaign: OutreachCampaign; tickResult: { draftsGenerated: number; sent: number; blocked: number; failed: number } }> {
  return apiRequest(`/outreach/campaigns/${id}/start`, { method: 'POST' });
}

export function pauseCampaign(id: string): Promise<{ campaign: OutreachCampaign }> {
  return apiRequest(`/outreach/campaigns/${id}/pause`, { method: 'POST' });
}

export function cancelCampaign(id: string): Promise<{ campaign: OutreachCampaign }> {
  return apiRequest(`/outreach/campaigns/${id}/cancel`, { method: 'POST' });
}

export function deleteCampaign(id: string): Promise<void> {
  return apiRequest(`/outreach/campaigns/${id}`, { method: 'DELETE' });
}

// --- Drafts ---
export function listDrafts(campaignId?: string): Promise<{ drafts: OutreachDraft[] }> {
  return apiRequest(`/outreach/drafts${campaignId ? `?campaignId=${campaignId}` : ''}`);
}

export function updateDraft(id: string, input: { subject?: string; finalBody?: string }): Promise<{ draft: OutreachDraft }> {
  return apiRequest(`/outreach/drafts/${id}`, { method: 'PATCH', body: input });
}

export function approveDraft(id: string): Promise<{ draft: OutreachDraft; sendOutcome: 'sent' | 'blocked' | 'failed' | 'not_running' }> {
  return apiRequest(`/outreach/drafts/${id}/approve`, { method: 'POST' });
}

export function rejectDraft(id: string): Promise<{ draft: OutreachDraft }> {
  return apiRequest(`/outreach/drafts/${id}/reject`, { method: 'POST' });
}

export function regenerateDraft(id: string): Promise<{ draft: OutreachDraft }> {
  return apiRequest(`/outreach/drafts/${id}/regenerate`, { method: 'POST' });
}

// --- Messages / events / replies ---
export function listMessages(): Promise<{ messages: OutreachMessage[] }> {
  return apiRequest('/outreach/messages');
}

export function listReplies(): Promise<{ replies: EmailReply[] }> {
  return apiRequest('/outreach/replies');
}

export function simulateReply(input: { fromEmail: string; body: string; subject?: string }): Promise<{ result: { skipped: boolean; classification?: string; leadCreated?: boolean } }> {
  return apiRequest('/outreach/dev/simulate-reply', { method: 'POST', body: input });
}

// --- Providers / usage ---
export function getProviders(): Promise<{ providers: OutreachProvidersOverview }> {
  return apiRequest('/outreach/providers');
}

export function getUsage(): Promise<{ provider: string; usage: { sentToday: number; sentThisMonth: number; failedThisMonth: number; bouncedThisMonth: number }; dailyLimit: number }> {
  return apiRequest('/outreach/usage');
}

export function runTick(): Promise<{ result: { draftsGenerated: number; sent: number; blocked: number; failed: number } }> {
  return apiRequest('/outreach/tick', { method: 'POST' });
}

// --- Suppressions ---
export function listSuppressions(): Promise<{ suppressions: Suppression[] }> {
  return apiRequest('/outreach/suppressions');
}

export function addSuppression(email: string, reason: Suppression['reason'] = 'manual'): Promise<void> {
  return apiRequest('/outreach/suppressions', { method: 'POST', body: { email, reason } });
}

export function removeSuppression(email: string): Promise<{ removed: boolean }> {
  return apiRequest(`/outreach/suppressions/${encodeURIComponent(email)}`, { method: 'DELETE' });
}

// --- Sheet imports ---
export function listImports(): Promise<{ imports: SheetImport[] }> {
  return apiRequest('/outreach/imports');
}

export function triggerImport(opts: { connectionId?: string; campaignId?: string; skipAutoCampaign?: boolean } = {}): Promise<{
  import: SheetImport;
  campaign?: OutreachCampaign | null;
  campaignResult?: { added: number; draftsGenerated: number };
}> {
  return apiRequest('/outreach/imports', { method: 'POST', body: opts });
}

// --- Settings ---
export function getSettings(): Promise<{ settings: EmailSettings | null }> {
  return apiRequest('/outreach/settings');
}

export function updateSettings(input: Partial<{ defaultSenderName: string | null; defaultSenderEmail: string | null; defaultReplyTo: string | null; dailySendLimit: number; voiceDescription: string | null }>): Promise<{ settings: EmailSettings }> {
  return apiRequest('/outreach/settings', { method: 'PATCH', body: input });
}

// --- Google Sheets connection (under integrations) ---
export function getSheetConnection(): Promise<{ connection: { id: string; name: string; spreadsheet_id: string | null; sheet_range: string; status: string; last_synced_at: string | null } | null; provider: { name: string; selected: string } }> {
  return apiRequest('/integrations/google-sheets');
}

export function upsertSheetConnection(input: { name: string; spreadsheetId?: string | null; sheetRange?: string }): Promise<{ connection: unknown }> {
  return apiRequest('/integrations/google-sheets', { method: 'POST', body: input });
}

export function disconnectSheetConnection(): Promise<void> {
  return apiRequest('/integrations/google-sheets', { method: 'DELETE' });
}
