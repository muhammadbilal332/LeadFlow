import { apiRequest } from '../lib/api';
import { AutomationRule, AutomationCondition, AutomationAction } from '../types';

export function listAutomationRules(): Promise<{ rules: AutomationRule[] }> {
  return apiRequest('/automations');
}

export interface AutomationRuleInput {
  name: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority?: number;
}

export function createAutomationRule(input: AutomationRuleInput): Promise<{ rule: AutomationRule }> {
  return apiRequest('/automations', { method: 'POST', body: input });
}

export function updateAutomationRule(id: string, input: Partial<AutomationRuleInput & { isActive: boolean }>): Promise<{ rule: AutomationRule }> {
  return apiRequest(`/automations/${id}`, { method: 'PATCH', body: input });
}

export function deleteAutomationRule(id: string): Promise<void> {
  return apiRequest(`/automations/${id}`, { method: 'DELETE' });
}
