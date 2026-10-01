import { apiRequest } from '../lib/api';
import { RoutingRule, SlaSettings } from '../types';

export function listRoutingRules(): Promise<{ rules: RoutingRule[] }> {
  return apiRequest('/routing/rules');
}

export interface RoutingRuleInput {
  name: string;
  priority: number;
  field: 'source' | 'industry' | 'score' | 'always';
  operator: 'equals' | 'gte' | 'lte';
  value?: string | null;
  assignmentType: 'user' | 'round_robin' | 'owner';
  assignUserId?: string | null;
}

export function createRoutingRule(input: RoutingRuleInput): Promise<{ rule: RoutingRule }> {
  return apiRequest('/routing/rules', { method: 'POST', body: input });
}

export function updateRoutingRule(id: string, input: Partial<RoutingRuleInput & { isActive: boolean }>): Promise<{ rule: RoutingRule }> {
  return apiRequest(`/routing/rules/${id}`, { method: 'PATCH', body: input });
}

export function deleteRoutingRule(id: string): Promise<void> {
  return apiRequest(`/routing/rules/${id}`, { method: 'DELETE' });
}

export function getSlaSettings(): Promise<{ settings: SlaSettings }> {
  return apiRequest('/routing/sla');
}

export function updateSlaSettings(input: Partial<{ hotMinutes: number; highMinutes: number; mediumMinutes: number; lowMinutes: number }>): Promise<{ settings: SlaSettings }> {
  return apiRequest('/routing/sla', { method: 'PATCH', body: input });
}
