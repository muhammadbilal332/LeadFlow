import { apiRequest } from '../lib/api';
import { IntegrationsOverview, WebhookInfo, WebhookDelivery, ApiKey } from '../types';

// Integrations are developer-console-only (see docs/DEVELOPER_DASHBOARD.md)
// — every call here now runs as the `developer` role, which must say which
// real business it's acting on via `businessId` (see
// server/src/middleware/requireTargetBusiness.ts). API keys are unaffected
// and keep working without it (still an owner/manager-facing feature).
function withBusiness(path: string, businessId?: string): string {
  return businessId ? `${path}${path.includes('?') ? '&' : '?'}businessId=${encodeURIComponent(businessId)}` : path;
}

export function getIntegrationsOverview(businessId: string): Promise<IntegrationsOverview> {
  return apiRequest(withBusiness('/integrations', businessId));
}

export function createOrRotateWebhook(businessId: string): Promise<{ webhook: WebhookInfo; secret: string }> {
  return apiRequest(withBusiness('/integrations/webhook', businessId), { method: 'POST' });
}

export function setWebhookActive(businessId: string, isActive: boolean): Promise<{ webhook: WebhookInfo }> {
  return apiRequest(withBusiness('/integrations/webhook', businessId), { method: 'PATCH', body: { isActive } });
}

export function listWebhookDeliveries(businessId: string): Promise<{ deliveries: WebhookDelivery[] }> {
  return apiRequest(withBusiness('/integrations/webhook/deliveries', businessId));
}

// API keys
export function listApiKeys(): Promise<{ apiKeys: ApiKey[] }> {
  return apiRequest('/api-keys');
}

export function createApiKey(name: string): Promise<{ apiKey: ApiKey; key: string }> {
  return apiRequest('/api-keys', { method: 'POST', body: { name } });
}

export function revokeApiKey(id: string): Promise<void> {
  return apiRequest(`/api-keys/${id}`, { method: 'DELETE' });
}
