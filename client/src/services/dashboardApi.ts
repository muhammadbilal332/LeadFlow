import { apiRequest } from '../lib/api';
import { DashboardData, ReportsData, PipelineColumn } from '../types';

export function getDashboard(): Promise<DashboardData> {
  return apiRequest('/dashboard');
}

export function getReports(): Promise<ReportsData> {
  return apiRequest('/reports');
}

export function getPipeline(): Promise<{ columns: PipelineColumn[] }> {
  return apiRequest('/pipeline');
}
