import { apiRequest } from '../lib/api';
import { Lead, Pagination, Activity, Note, FollowUp, AiQualification } from '../types';

export interface LeadFilters {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  source?: string;
  assignedUserId?: string;
  minScore?: number;
  maxScore?: number;
  priority?: string;
  campaignId?: string;
  slaStatus?: string;
  unworkedOnly?: boolean;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

function buildQuery(filters: LeadFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function listLeads(filters: LeadFilters): Promise<{ leads: Lead[]; pagination: Pagination }> {
  return apiRequest(`/leads${buildQuery(filters)}`);
}

export function getLead(id: string): Promise<{ lead: Lead }> {
  return apiRequest(`/leads/${id}`);
}

export interface LeadInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source: string;
  industry?: string;
  interestedIn?: string;
  budget?: number | '';
  timeline?: string;
  description?: string;
  assignedUserId?: string | null;
}

export function createLead(input: LeadInput): Promise<{ lead: Lead }> {
  return apiRequest('/leads', { method: 'POST', body: input });
}

export function updateLead(id: string, input: Partial<LeadInput & { status: string }>): Promise<{ lead: Lead }> {
  return apiRequest(`/leads/${id}`, { method: 'PATCH', body: input });
}

export function deleteLead(id: string): Promise<void> {
  return apiRequest(`/leads/${id}`, { method: 'DELETE' });
}

export function listNotes(leadId: string): Promise<{ notes: Note[] }> {
  return apiRequest(`/leads/${leadId}/notes`);
}

export function createNote(leadId: string, content: string): Promise<{ note: Note }> {
  return apiRequest(`/leads/${leadId}/notes`, { method: 'POST', body: { content } });
}

export function listActivities(leadId: string): Promise<{ activities: Activity[] }> {
  return apiRequest(`/leads/${leadId}/activities`);
}

export function listLeadFollowUps(leadId: string): Promise<{ followUps: FollowUp[] }> {
  return apiRequest(`/leads/${leadId}/follow-ups`);
}

export function qualifyLeadAi(leadId: string): Promise<{ qualification: AiQualification }> {
  return apiRequest(`/leads/${leadId}/qualify-ai`, { method: 'POST' });
}

export function getLatestAiQualification(leadId: string): Promise<{ qualification: AiQualification | null }> {
  return apiRequest(`/leads/${leadId}/ai-qualification`);
}

export function importLeads(csv: string): Promise<{ imported: number; failed: number; errors: Array<{ row: number; message: string }> }> {
  return apiRequest('/leads/import', { method: 'POST', body: { csv } });
}

export function listDuplicates(): Promise<{ duplicates: Array<Lead & { duplicate_of_name: string }> }> {
  return apiRequest('/leads/duplicates');
}

export function mergeLeads(sourceLeadId: string, targetLeadId: string): Promise<{ lead: Lead }> {
  return apiRequest('/leads/merge', { method: 'POST', body: { sourceLeadId, targetLeadId } });
}

export async function downloadLeadsCsv(): Promise<void> {
  const csv = await apiRequest<string>('/leads/export', { raw: true });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leads-export.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
