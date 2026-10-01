import { apiRequest } from '../lib/api';
import {
  PlatformOverview, TimeSeriesPoint, BusinessSummary, BusinessDetail, PlatformUser, PlatformLead,
  OutreachLifecycleStats, RecentCampaignSummary, N8nExecutionLog, N8nSummary, HealthServices,
  SystemEvent, DeveloperAuditLog, OutreachProvidersOverview,
} from '../types';

export function getOverview(days = 30): Promise<{ overview: PlatformOverview; charts: { leadsOverTime: TimeSeriesPoint[]; emailsOverTime: TimeSeriesPoint[]; repliesOverTime: TimeSeriesPoint[] } }> {
  return apiRequest(`/developer/overview?days=${days}`);
}

export function listBusinesses(): Promise<{ businesses: BusinessSummary[] }> {
  return apiRequest('/developer/businesses');
}

export function getBusiness(id: string): Promise<{ business: BusinessDetail }> {
  return apiRequest(`/developer/businesses/${id}`);
}

export function deactivateBusiness(id: string): Promise<{ business: BusinessDetail }> {
  return apiRequest(`/developer/businesses/${id}/deactivate`, { method: 'POST' });
}

export function reactivateBusiness(id: string): Promise<{ business: BusinessDetail }> {
  return apiRequest(`/developer/businesses/${id}/reactivate`, { method: 'POST' });
}

export function deleteBusiness(id: string): Promise<void> {
  return apiRequest(`/developer/businesses/${id}`, { method: 'DELETE' });
}

export function listUsers(): Promise<{ users: PlatformUser[] }> {
  return apiRequest('/developer/users');
}

export function changeUserRole(id: string, role: 'owner' | 'sales'): Promise<{ user: PlatformUser }> {
  return apiRequest(`/developer/users/${id}/role`, { method: 'PATCH', body: { role } });
}

export function setUserStatus(id: string, isActive: boolean): Promise<{ user: PlatformUser }> {
  return apiRequest(`/developer/users/${id}/status`, { method: 'PATCH', body: { isActive } });
}

export function listLeads(params: { search?: string; businessId?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<{ leads: PlatformLead[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.businessId) qs.set('businessId', params.businessId);
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.pageSize) qs.set('pageSize', String(params.pageSize));
  const query = qs.toString();
  return apiRequest(`/developer/leads${query ? `?${query}` : ''}`);
}

export function getOutreach(): Promise<{ lifecycle: OutreachLifecycleStats; campaigns: RecentCampaignSummary[] }> {
  return apiRequest('/developer/outreach');
}

export function getN8n(): Promise<{ connected: boolean; summary: N8nSummary; recent: N8nExecutionLog[] }> {
  return apiRequest('/developer/n8n');
}

export function getHealth(): Promise<{ services: HealthServices }> {
  return apiRequest('/developer/health');
}

export function getProviders(): Promise<{ providers: OutreachProvidersOverview }> {
  return apiRequest('/developer/providers');
}

export interface DeveloperUsage {
  provider: string;
  daily: { sent: number; failed: number; bounced: number };
  monthly: { sent: number; failed: number; bounced: number };
  aiGenerationsTotal: number;
  n8nExecutionsTotal: number;
  dailyLimitPerBusiness: number;
  plannedMonthlyLimit: number;
}

export function getUsage(): Promise<DeveloperUsage> {
  return apiRequest('/developer/usage');
}

export function getLogs(severity?: 'info' | 'warning' | 'error'): Promise<{ events: SystemEvent[] }> {
  return apiRequest(`/developer/logs${severity ? `?severity=${severity}` : ''}`);
}

export function getAuditLogs(): Promise<{ logs: DeveloperAuditLog[] }> {
  return apiRequest('/developer/audit');
}
