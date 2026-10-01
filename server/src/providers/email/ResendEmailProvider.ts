import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { EmailProvider, EmailWebhookEvent, ProviderUsageSnapshot, SendEmailInput, SendEmailResult } from './EmailProvider';

/**
 * Real provider for Resend (https://resend.com), which has a genuinely free
 * tier suitable for the ~25k/month scale this platform targets. Prepared
 * and structurally complete, but only reachable when EMAIL_PROVIDER=resend
 * AND RESEND_API_KEY is set — otherwise isConfigured() is false and the
 * caller (outreachQueueService) refuses to use it rather than silently
 * degrading or pretending to send.
 */
export class ResendEmailProvider implements EmailProvider {
  name = 'resend';

  isConfigured(): boolean {
    return Boolean(env.RESEND_API_KEY);
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      return { status: 'failed', providerMessageId: null, error: 'Resend is not configured (missing RESEND_API_KEY)' };
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        // Resend's idempotency support: a retried send with the same key
        // never results in a duplicate email.
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        from: `${input.fromName} <${input.fromEmail}>`,
        to: [input.to],
        reply_to: input.replyTo || undefined,
        subject: input.subject,
        text: input.body,
        // A reply-based unsubscribe mechanism already exists (see
        // simulateReply/classifyReply) — this header just surfaces it to
        // the mail client as a real unsubscribe option, which is both a
        // bulk-sender requirement for Gmail/Yahoo and a meaningful spam
        // score signal on its own. mailto-only, so no List-Unsubscribe-Post
        // (that header only applies to a one-click HTTPS unsubscribe URL).
        headers: {
          'List-Unsubscribe': `<mailto:${input.replyTo || input.fromEmail}?subject=unsubscribe>`,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { status: 'failed', providerMessageId: null, error: `Resend request failed (${res.status}): ${body}` };
    }

    const data = (await res.json()) as { id: string };
    return { status: 'sent', providerMessageId: data.id };
  }

  parseStatusWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): EmailWebhookEvent[] {
    if (!this.verifySignature(rawBody, headers)) return [];

    const payload = JSON.parse(rawBody.toString('utf8')) as { type?: string; data?: { email_id?: string; created_at?: string; bounce?: { message?: string } } };
    const typeMap: Record<string, EmailWebhookEvent['type']> = {
      'email.delivered': 'delivered',
      'email.bounced': 'bounced',
      'email.complained': 'complaint',
      'email.opened': 'opened',
      'email.delivery_delayed': 'failed',
    };
    const mapped = payload.type ? typeMap[payload.type] : undefined;
    if (!mapped || !payload.data?.email_id) return [];

    return [
      {
        providerMessageId: payload.data.email_id,
        type: mapped,
        occurredAt: payload.data.created_at || new Date().toISOString(),
        reason: payload.data.bounce?.message,
      },
    ];
  }

  private verifySignature(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
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

  async getUsage(): Promise<ProviderUsageSnapshot> {
    // Resend does not expose a simple usage-count API; LeadFlow tracks its
    // own send counts in the provider_usage table (see providerUsageService),
    // which is authoritative regardless of which provider is active.
    return { sentToday: 0, sentThisMonth: 0 };
  }
}
