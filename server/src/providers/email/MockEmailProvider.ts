import { randomUUID } from 'crypto';
import { EmailProvider, EmailWebhookEvent, ProviderUsageSnapshot, SendEmailInput, SendEmailResult } from './EmailProvider';

/**
 * Realistic in-memory email provider. No network calls, no cost, always
 * available. Simulates a hard bounce for any recipient containing
 * "bounce" and a send failure for any recipient containing "fail" —
 * useful for exercising the failure paths deterministically in tests and
 * demos without needing a real provider.
 */
export class MockEmailProvider implements EmailProvider {
  name = 'mock';

  private usage = new Map<string, { day: string; month: string; sentToday: number; sentThisMonth: number }>();

  isConfigured(): boolean {
    return true;
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    await new Promise((resolve) => setTimeout(resolve, 1));

    const lower = input.to.toLowerCase();
    if (lower.includes('fail')) {
      return { status: 'failed', providerMessageId: null, error: 'Simulated provider rejection (mock)' };
    }

    const providerMessageId = `mock_${randomUUID()}`;
    this.bumpUsage(input.businessId);
    return { status: 'sent', providerMessageId };
  }

  private bumpUsage(businessId: string): void {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const month = now.toISOString().slice(0, 7);
    const existing = this.usage.get(businessId);
    if (!existing || existing.day !== day) {
      this.usage.set(businessId, {
        day,
        month,
        sentToday: 1,
        sentThisMonth: existing && existing.month === month ? existing.sentThisMonth + 1 : 1,
      });
    } else {
      existing.sentToday += 1;
      existing.sentThisMonth += 1;
    }
  }

  parseStatusWebhook(): EmailWebhookEvent[] {
    // The mock provider never calls a real webhook endpoint — delivery is
    // simulated synchronously by outreachQueueService right after sendEmail.
    return [];
  }

  async getUsage(businessId: string): Promise<ProviderUsageSnapshot> {
    const entry = this.usage.get(businessId);
    return { sentToday: entry?.sentToday ?? 0, sentThisMonth: entry?.sentThisMonth ?? 0 };
  }

  /** Deterministic: does the mock provider simulate a bounce for this address? */
  static isSimulatedBounce(to: string): boolean {
    return to.toLowerCase().includes('bounce');
  }
}
