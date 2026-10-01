import { apiRequest } from '../lib/api';
import { FollowUp } from '../types';

export interface FollowUpInput {
  leadId: string;
  type: string;
  scheduledAt: string;
  notes?: string;
}

export function listFollowUps(status?: string): Promise<{ followUps: FollowUp[] }> {
  return apiRequest(`/follow-ups${status ? `?status=${status}` : ''}`);
}

export function createFollowUp(input: FollowUpInput): Promise<{ followUp: FollowUp }> {
  return apiRequest('/follow-ups', { method: 'POST', body: input });
}

export function updateFollowUp(id: string, input: Partial<{ type: string; scheduledAt: string; notes: string; completed: boolean }>): Promise<{ followUp: FollowUp }> {
  return apiRequest(`/follow-ups/${id}`, { method: 'PATCH', body: input });
}
