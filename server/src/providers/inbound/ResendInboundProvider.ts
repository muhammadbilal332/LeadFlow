import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { InboundEmailEvent, InboundProvider } from './InboundProvider';

/**
 * Real provider for Resend's inbound email webhook. Structurally complete
 * but only reachable when INBOUND_PROVIDER=resend AND RESEND_WEBHOOK_SECRET
 * is set (a real inbound route additionally requires DNS/MX configuration
 * on Resend's side, which is outside this codebase's control).
 */
export class ResendInboundProvider implements InboundProvider {
  name = 'resend';

  isConfigured(): boolean {
    return Boolean(env.RESEND_WEBHOOK_SECRET);
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    if (!env.RESEND_WEBHOOK_SECRET) return false;
    const signature = headers['svix-signature'] || headers['resend-signature'];
    if (!signature || typeof signature !== 'string') return false;

    const expected = createHmac('sha256', env.RESEND_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const provided = signature.split(',').pop() ?? signature;
    try {
      return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }

  parseWebhook(rawBody: Buffer): InboundEmailEvent[] {
    const payload = JSON.parse(rawBody.toString('utf8')) as {
      type?: string;
      data?: { id?: string; from?: string; to?: string; subject?: string; text?: string; in_reply_to?: string; created_at?: string };
    };
    if (payload.type !== 'email.received' || !payload.data) return [];

    return [
      {
        providerReplyId: payload.data.id || '',
        providerMessageId: payload.data.in_reply_to ?? null,
        fromEmail: payload.data.from || '',
        toEmail: payload.data.to || '',
        subject: payload.data.subject ?? null,
        body: payload.data.text || '',
        receivedAt: payload.data.created_at || new Date().toISOString(),
      },
    ];
  }
}
