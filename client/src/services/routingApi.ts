import { apiRequest } from '../lib/api';
import { RoutingRule, SlaSettings } from '../types';

// Lead routing is developer-console-only (see docs/DEVELOPER_DASHBOARD.md)
// — every call here now runs as the `developer` role, which must say which
// real business it's acting on via `businessId` (see
// server/src/middleware/requireTargetBusiness.ts).
function withBusiness(path: string, businessId?: string): string {
  return businessId ? `${path}${path.includes('?') ? '&' : '?'}businessId=${encodeURIComponent(businessId)}` : path;
}

export function listRoutingRules(businessId: string): Promise<{ rules: RoutingRule[] }> {
  return apiRequest(withBusiness('/routing/rules', businessId));
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

export function createRoutingRule(businessId: string, input: RoutingRuleInput): Promise<{ rule: RoutingRule }> {
  return apiRequest(withBusiness('/routing/rules', businessId), { method: 'POST', body: input });
}

export function updateRoutingRule(businessId: string, id: string, input: Partial<RoutingRuleInput & { isActive: boolean }>): Promise<{ rule: RoutingRule }> {
  return apiRequest(withBusiness(`/routing/rules/${id}`, businessId), { method: 'PATCH', body: input });
}

export function deleteRoutingRule(businessId: string, id: string): Promise<void> {
  return apiRequest(withBusiness(`/routing/rules/${id}`, businessId), { method: 'DELETE' });
}

export function getSlaSettings(businessId: string): Promise<{ settings: SlaSettings }> {
  return apiRequest(withBusiness('/routing/sla', businessId));
}

export function updateSlaSettings(businessId: string, input: Partial<{ hotMinutes: number; highMinutes: number; mediumMinutes: number; lowMinutes: number }>): Promise<{ settings: SlaSettings }> {
  return apiRequest(withBusiness('/routing/sla', businessId), { method: 'PATCH', body: input });
}
