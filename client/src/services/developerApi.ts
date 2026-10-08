import { apiRequest } from '../lib/api';
import {
  PlatformOverview, TimeSeriesPoint, PlatformUser,
  OutreachLifecycleStats, RecentCampaignSummary, AutomationExecutionLog, AutomationSummary, HealthServices,
  SystemEvent, DeveloperAuditLog, OutreachProvidersOverview,
} from '../types';

export function getOverview(days = 30): Promise<{ overview: PlatformOverview; charts: { leadsOverTime: TimeSeriesPoint[]; emailsOverTime: TimeSeriesPoint[]; repliesOverTime: TimeSeriesPoint[] } }> {
  return apiRequest(`/developer/overview?days=${days}`);
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

export function getOutreach(): Promise<{ lifecycle: OutreachLifecycleStats; campaigns: RecentCampaignSummary[] }> {
  return apiRequest('/developer/outreach');
}

export function getAutomationStatus(): Promise<{ connected: boolean; summary: AutomationSummary; recent: AutomationExecutionLog[] }> {
  return apiRequest('/developer/automation');
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
  automationExecutionsTotal: number;
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
