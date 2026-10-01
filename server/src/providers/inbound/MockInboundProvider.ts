import { randomUUID } from 'crypto';
import { InboundEmailEvent, InboundProvider } from './InboundProvider';

/**
 * No real inbound webhook exists for the mock provider — there's no live
 * mailbox to receive replies. Instead, `buildSimulatedEvent` lets the dev
 * simulate-reply endpoint (POST /api/outreach/dev/simulate-reply, used by
 * the demo flow and tests) construct a realistic InboundEmailEvent that
 * flows through the exact same replyProcessingService code path a real
 * webhook would use.
 */
export class MockInboundProvider implements InboundProvider {
  name = 'mock';

  isConfigured(): boolean {
    return true;
  }

  verifyWebhook(): boolean {
    return true;
  }

  parseWebhook(rawBody: Buffer): InboundEmailEvent[] {
    const payload = JSON.parse(rawBody.toString('utf8')) as { fromEmail: string; toEmail?: string; subject?: string; body: string; providerMessageId?: string | null };
    return [this.buildSimulatedEvent(payload)];
  }

  buildSimulatedEvent(input: { fromEmail: string; toEmail?: string; subject?: string; body: string; providerMessageId?: string | null }): InboundEmailEvent {
    return {
      providerReplyId: `mock_reply_${randomUUID()}`,
      providerMessageId: input.providerMessageId ?? null,
      fromEmail: input.fromEmail,
      toEmail: input.toEmail ?? '',
      subject: input.subject ?? null,
      body: input.body,
      receivedAt: new Date().toISOString(),
    };
  }
}
