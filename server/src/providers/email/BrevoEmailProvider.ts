import { timingSafeEqual } from 'crypto';
import { env } from '../../config/env';
import { EmailProvider, EmailWebhookEvent, ProviderUsageSnapshot, SendEmailInput, SendEmailResult } from './EmailProvider';

/**
 * Real provider for Brevo (https://brevo.com, formerly Sendinblue), which
 * has a genuinely free tier (300 emails/day, no credit card). Only
 * reachable when EMAIL_PROVIDER=brevo AND BREVO_API_KEY is set — otherwise
 * isConfigured() is false and the caller (outreachQueueService) refuses to
 * use it rather than silently degrading or pretending to send.
 *
 * Unlike Resend, Brevo can verify a single sender *address* via a
 * confirmation-link click (Brevo dashboard → Senders), not only a full
 * domain via DNS records — so it can accept a send from a personal inbox
 * that Resend would always hard-reject. That only avoids the outright
 * rejection, though: without also authenticating a real domain (SPF/DKIM),
 * mail from a personal address still won't carry proper domain alignment
 * and can still land in spam. A verified domain is still the real fix for
 * deliverability, whichever provider is used.
 */
export class BrevoEmailProvider implements EmailProvider {
  name = 'brevo';

  isConfigured(): boolean {
    return Boolean(env.BREVO_API_KEY);
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    if (!this.isConfigured()) {
      return { status: 'failed', providerMessageId: null, error: 'Brevo is not configured (missing BREVO_API_KEY)' };
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': env.BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: input.fromName, email: input.fromEmail },
        to: [{ email: input.to }],
        replyTo: input.replyTo ? { email: input.replyTo } : undefined,
        subject: input.subject,
        textContent: input.body,
        headers: {
          // Brevo has no built-in idempotency-key mechanism like Resend's
          // Idempotency-Key header — the idempotency guarantee instead
          // comes from outreachQueueService checking outreach_messages by
          // idempotencyKey BEFORE this is ever called, so a retried tick
          // never re-sends the same draft regardless of provider. This tag
          // just keeps the key visible on Brevo's own side for debugging.
          'X-Idempotency-Key': input.idempotencyKey,
          'List-Unsubscribe': `<mailto:${input.replyTo || input.fromEmail}?subject=unsubscribe>`,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { status: 'failed', providerMessageId: null, error: `Brevo request failed (${res.status}): ${body}` };
    }

    const data = (await res.json()) as { messageId: string };
    return { status: 'sent', providerMessageId: data.messageId };
  }

  parseStatusWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): EmailWebhookEvent[] {
    if (!this.verifyWebhook(headers)) return [];

    const payload = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      'message-id'?: string;
      date?: string;
      reason?: string;
    };

    // Brevo's own event vocabulary, mapped to this app's normalized set.
    const typeMap: Record<string, EmailWebhookEvent['type']> = {
      delivered: 'delivered',
      hard_bounce: 'bounced',
      soft_bounce: 'bounced',
      spam: 'complaint',
      opened: 'opened',
      blocked: 'failed',
      error: 'failed',
    };

    const mapped = payload.event ? typeMap[payload.event] : undefined;
    if (!mapped || !payload['message-id']) return [];

    return [
      {
        providerMessageId: payload['message-id'],
        type: mapped,
        occurredAt: payload.date || new Date().toISOString(),
        reason: payload.reason,
      },
    ];
  }

  /**
   * Brevo doesn't sign webhook payloads with HMAC the way Resend/Svix does
   * — instead it lets you attach a custom header to the webhook config in
   * its dashboard. This checks that shared-secret header rather than
   * verifying a signature that doesn't exist on Brevo's side.
   */
  private verifyWebhook(headers: Record<string, string | string[] | undefined>): boolean {
    if (!env.BREVO_WEBHOOK_SECRET) return false;
    const provided = headers['x-webhook-secret'];
    if (!provided || typeof provided !== 'string') return false;
    try {
      const expected = Buffer.from(env.BREVO_WEBHOOK_SECRET);
      const actual = Buffer.from(provided);
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<ProviderUsageSnapshot> {
    // Brevo's account-usage API requires a separate endpoint/scope; LeadFlow
    // tracks its own send counts in provider_usage (see providerUsageService),
    // which is authoritative regardless of which provider is active.
    return { sentToday: 0, sentThisMonth: 0 };
  }
}
