import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { getInboundProvider } from '../providers/inbound';
import { getEmailProvider } from '../providers/email';
import { processInboundReply } from '../services/outreach/replyProcessingService';
import * as outreachMessageRepo from '../repositories/outreachMessageRepo';
import * as outreachEventRepo from '../repositories/outreachEventRepo';
import * as providerUsageRepo from '../repositories/providerUsageRepo';
import * as suppressionService from '../services/outreach/suppressionService';
import * as campaignContactRepo from '../repositories/campaignContactRepo';
import * as outreachContactRepo from '../repositories/outreachContactRepo';
import { NotFoundError } from '../utils/appError';

/**
 * Real-provider inbound reply webhook. The businessId is embedded in the
 * URL path — with a real Resend account, each business configures its own
 * webhook URL (see docs/OUTREACH.md) pointing back here. Only reachable
 * when INBOUND_PROVIDER=resend AND RESEND_WEBHOOK_SECRET is set; the mock
 * pipeline uses POST /api/outreach/dev/simulate-reply instead, since there
 * is no real mailbox for the mock provider to receive against.
 */
export const receiveInboundEmail = asyncHandler(async (req: Request, res: Response) => {
  const provider = getInboundProvider();
  const businessId = req.params.businessId;
  if (!businessId) throw new NotFoundError('Unknown webhook destination');

  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!provider.verifyWebhook(rawBody, req.headers as Record<string, string | string[] | undefined>)) {
    res.status(403).json({ error: 'Invalid signature' });
    return;
  }

  const events = provider.parseWebhook(rawBody);
  for (const event of events) {
    await processInboundReply(businessId, event);
  }

  res.status(200).json({ received: events.length });
});

/** Real-provider delivery-status webhook (delivered/bounced/complaint/opened). */
export const receiveDeliveryStatus = asyncHandler(async (req: Request, res: Response) => {
  const provider = getEmailProvider();
  const businessId = req.params.businessId;
  if (!businessId) throw new NotFoundError('Unknown webhook destination');

  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  const events = provider.parseStatusWebhook(rawBody, req.headers as Record<string, string | string[] | undefined>);

  for (const event of events) {
    const message = await outreachMessageRepo.findByProviderMessageId(businessId, event.providerMessageId);
    if (!message) continue;

    if (event.type === 'delivered') {
      await outreachMessageRepo.markDelivered(message.id);
    } else if (event.type === 'bounced') {
      await outreachMessageRepo.markBounced(message.id, event.reason || 'Bounced');
      await providerUsageRepo.recordSend(businessId, provider.name, 'bounced');
      const cc = await campaignContactRepo.findById(message.campaign_contact_id, businessId);
      if (cc) {
        const contact = await outreachContactRepo.findById(cc.contact_id, businessId);
        if (contact) await suppressionService.suppress(businessId, contact.email, 'bounce', provider.name);
      }
    } else if (event.type === 'failed') {
      await outreachMessageRepo.markFailed(message.id, event.reason || 'Failed');
    }

    await outreachEventRepo.recordEvent({ businessId, messageId: message.id, type: event.type, payload: { reason: event.reason } });
  }

  res.status(200).json({ received: events.length });
});
