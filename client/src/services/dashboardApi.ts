import { apiRequest } from '../lib/api';
import { DashboardData, ReportsData, PipelineColumn, PerformancePeriod, PersonEmail, EmailReplyItem } from '../types';

/**
 * Start of the selected period in the viewer's local time: today at midnight,
 * Monday of this week, or the 1st of this month. Sent as ?since so the server
 * counts exactly that calendar period for this user.
 */
export function periodStart(period: PerformancePeriod, now: Date = new Date()): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  if (period === 'month') start.setDate(1);
  return start.toISOString();
}

function periodQuery(period: PerformancePeriod): string {
  return `period=${period}&since=${encodeURIComponent(periodStart(period))}`;
}

export function getDashboard(period: PerformancePeriod = 'week'): Promise<DashboardData> {
  return apiRequest(`/dashboard?${periodQuery(period)}`);
}

export function getPersonEmails(userId: string, period: PerformancePeriod): Promise<{ person: { id: string; name: string; role: string }; emails: PersonEmail[] }> {
  return apiRequest(`/dashboard/people/${userId}/emails?${periodQuery(period)}`);
}

export function getPersonEmail(userId: string, messageId: string): Promise<{ email: PersonEmail; replies: EmailReplyItem[] }> {
  return apiRequest(`/dashboard/people/${userId}/emails/${messageId}`);
}

export function getReports(): Promise<ReportsData> {
  return apiRequest('/reports');
}

export function getPipeline(): Promise<{ columns: PipelineColumn[] }> {
  return apiRequest('/pipeline');
}
