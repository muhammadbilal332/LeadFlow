import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { webhookLeadSchema } from '../validation/schemas';
import * as webhookRepo from '../repositories/webhookRepo';
import * as integrationRepo from '../repositories/integrationRepo';
import { hashSecret, decryptSecret } from '../utils/secrets';
import { UnauthorizedError } from '../utils/appError';
import { intakeLead } from '../services/leadIntakeService';
import { verifyWebhookChallenge, verifySignature, parseLeadgenEvents, fetchLeadFieldData } from '../services/metaService';
import { env } from '../config/env';

// ===========================================================
// Generic inbound webhook (n8n or any automation tool), authenticated
// with a per-business secret generated in Settings -> Integrations -> Webhooks.
// ===========================================================
export const receiveGenericWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = req.header('x-webhook-secret') ?? '';
  if (!secret) throw new UnauthorizedError('Missing X-Webhook-Secret header');

  const webhook = await webhookRepo.findWebhookBySecretHash(hashSecret(secret));
  if (!webhook) throw new UnauthorizedError('Invalid webhook secret');

  const parsed = webhookLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    await webhookRepo.recordDelivery({
      webhookId: webhook.id,
      businessId: webhook.business_id,
      status: 'Failed',
      payload: req.body,
      error: parsed.error.issues.map((i) => i.message).join('; '),
    });
    res.status(422).json({ error: 'Invalid payload', details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
    return;
  }

  const data = parsed.data;

  try {
    const result = await intakeLead({
      businessId: webhook.business_id,
      name: data.name,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      description: data.message || null,
      source: (data.source as string) || 'API',
      campaign: data.campaign || null,
      utmSource: data.utm_source || null,
      utmMedium: data.utm_medium || null,
      utmCampaign: data.utm_campaign || null,
      utmTerm: data.utm_term || null,
      utmContent: data.utm_content || null,
      externalSource: 'webhook',
    });

    await webhookRepo.recordDelivery({
      webhookId: webhook.id,
      businessId: webhook.business_id,
      status: 'Success',
      payload: req.body,
      leadId: result.lead.id,
    });

    res.status(201).json({ success: true, leadId: result.lead.id });
  } catch (err) {
    await webhookRepo.recordDelivery({
      webhookId: webhook.id,
      businessId: webhook.business_id,
      status: 'Failed',
      payload: req.body,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    throw err;
  }
});

// ===========================================================
// Meta (Facebook/Instagram) Lead Ads webhook
// ===========================================================
export const verifyMetaWebhook = (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'] as string | undefined;
  const token = req.query['hub.verify_token'] as string | undefined;
  const challenge = req.query['hub.challenge'] as string | undefined;

  if (verifyWebhookChallenge(mode, token) && challenge) {
    res.status(200).send(challenge);
    return;
  }
  res.status(403).json({ error: 'Webhook verification failed' });
};

export const receiveMetaWebhook = asyncHandler(async (req: Request, res: Response) => {
  const signature = req.header('x-hub-signature-256');
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

  if (!verifySignature(rawBody, signature)) {
    // Always 403 on bad signature; never process an unverified payload.
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  const events = parseLeadgenEvents(req.body);

  for (const event of events) {
    const integration = await integrationRepo.findIntegrationByExternalAccount('meta', event.pageId);
    if (!integration) {
      console.warn(`Meta webhook: no LeadFlow business is configured for Meta page ${event.pageId}`);
      continue;
    }

    const accessToken = decryptSecret(integration.access_token_encrypted ?? '', env.WEBHOOK_ENCRYPTION_KEY);

    if (!accessToken) {
      console.warn(
        `Meta webhook: lead ${event.leadgenId} received for page ${event.pageId}, but no page access token is configured — cannot fetch lead details.`
      );
      continue;
    }

    try {
      const fieldData = await fetchLeadFieldData(event.leadgenId, accessToken);
      await intakeLead({
        businessId: integration.business_id,
        name: fieldData.name || 'Facebook Lead',
        email: fieldData.email,
        phone: fieldData.phone,
        source: 'Facebook',
        campaign: null,
        ad: event.adId,
        adSet: event.adgroupId,
        externalSource: 'meta',
        externalId: event.leadgenId,
      });
    } catch (err) {
      console.error(`Meta webhook: failed to fetch/process lead ${event.leadgenId}:`, err instanceof Error ? err.message : err);
    }
  }

  // Meta requires a fast 200 OK regardless of downstream outcome, or it will
  // retry aggressively and may eventually disable the subscription.
  res.status(200).json({ received: true });
});
