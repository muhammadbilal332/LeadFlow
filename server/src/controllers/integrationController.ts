import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import * as webhookRepo from '../repositories/webhookRepo';
import * as integrationRepo from '../repositories/integrationRepo';
import { generateSecret, hashSecret } from '../utils/secrets';
import { publicAppUrl, env } from '../config/env';
import { NotFoundError } from '../utils/appError';

export const getIntegrationsOverview = asyncHandler(async (req: Request, res: Response) => {
  const [webhook, integrations] = await Promise.all([
    webhookRepo.findWebhookByBusiness(req.user!.businessId),
    integrationRepo.listIntegrations(req.user!.businessId),
  ]);

  const meta = integrations.find((i) => i.provider === 'meta') ?? null;

  res.json({
    webhook: webhook
      ? { id: webhook.id, secretPrefix: webhook.secret_prefix, isActive: webhook.is_active, lastDeliveryAt: webhook.last_delivery_at, url: `${publicAppUrl}/api/webhooks/leads` }
      : null,
    meta: {
      status: meta?.status ?? 'Disconnected',
      externalAccountId: meta?.external_account_id ?? null,
      hasCredentialsConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_VERIFY_TOKEN),
      webhookUrl: `${publicAppUrl}/api/webhooks/meta/leads`,
    },
  });
});

// ===========================================================
// Generic webhook secret management
// ===========================================================
export const createOrRotateWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = generateSecret(24);
  const secretPrefix = secret.slice(0, 8);
  const webhook = await webhookRepo.upsertWebhook(req.user!.businessId, hashSecret(secret), secretPrefix);

  res.status(201).json({
    webhook: { id: webhook.id, secretPrefix: webhook.secret_prefix, isActive: webhook.is_active, url: `${publicAppUrl}/api/webhooks/leads` },
    // Shown only once, at creation/rotation time.
    secret,
  });
});

export const setWebhookActiveHandler = asyncHandler(async (req: Request, res: Response) => {
  const schema = z.object({ isActive: z.boolean() });
  const { isActive } = schema.parse(req.body);
  const webhook = await webhookRepo.setWebhookActive(req.user!.businessId, isActive);
  if (!webhook) throw new NotFoundError('No webhook configured yet');
  res.json({ webhook: { id: webhook.id, secretPrefix: webhook.secret_prefix, isActive: webhook.is_active } });
});

export const listWebhookDeliveries = asyncHandler(async (req: Request, res: Response) => {
  const deliveries = await webhookRepo.listDeliveries(req.user!.businessId);
  res.json({ deliveries });
});

// ===========================================================
// Meta configuration
// ===========================================================
const metaConfigSchema = z.object({
  pageId: z.string().trim().min(1, 'A Meta Page ID is required'),
});

export const configureMeta = asyncHandler(async (req: Request, res: Response) => {
  const { pageId } = metaConfigSchema.parse(req.body);

  const integration = await integrationRepo.upsertIntegration({
    businessId: req.user!.businessId,
    provider: 'meta',
    status: 'Connected',
    externalAccountId: pageId,
  });

  res.json({
    meta: { status: integration.status, externalAccountId: integration.external_account_id },
  });
});

export const disconnectMeta = asyncHandler(async (req: Request, res: Response) => {
  const integration = await integrationRepo.upsertIntegration({
    businessId: req.user!.businessId,
    provider: 'meta',
    status: 'Disconnected',
    externalAccountId: null,
  });
  res.json({ meta: { status: integration.status, externalAccountId: integration.external_account_id } });
});
