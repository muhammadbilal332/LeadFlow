import { apiRequest } from '../lib/api';
import { IntegrationsOverview, WebhookInfo, WebhookDelivery, ApiKey } from '../types';

export function getIntegrationsOverview(): Promise<IntegrationsOverview> {
  return apiRequest('/integrations');
}

export function createOrRotateWebhook(): Promise<{ webhook: WebhookInfo; secret: string }> {
  return apiRequest('/integrations/webhook', { method: 'POST' });
}

export function setWebhookActive(isActive: boolean): Promise<{ webhook: WebhookInfo }> {
  return apiRequest('/integrations/webhook', { method: 'PATCH', body: { isActive } });
}

export function listWebhookDeliveries(): Promise<{ deliveries: WebhookDelivery[] }> {
  return apiRequest('/integrations/webhook/deliveries');
}

export function configureMeta(pageId: string): Promise<{ meta: { status: string; externalAccountId: string | null } }> {
  return apiRequest('/integrations/meta', { method: 'POST', body: { pageId } });
}

export function disconnectMeta(): Promise<{ meta: { status: string; externalAccountId: string | null } }> {
  return apiRequest('/integrations/meta', { method: 'DELETE' });
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
