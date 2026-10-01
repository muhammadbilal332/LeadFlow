/**
 * Email sending provider interface. Every outbound send in the outreach
 * pipeline goes through one of these implementations, selected purely by
 * the EMAIL_PROVIDER env var (see providers/email/index.ts) — no business
 * logic anywhere else knows or cares which one is active.
 */
export interface SendEmailInput {
  businessId: string;
  to: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  subject: string;
  body: string;
  /** Ensures a retried/duplicated send never delivers the same email twice. */
  idempotencyKey: string;
}

export interface SendEmailResult {
  status: 'sent' | 'failed';
  providerMessageId: string | null;
  error?: string;
}

export interface EmailWebhookEvent {
  providerMessageId: string;
  type: 'delivered' | 'bounced' | 'complaint' | 'opened' | 'failed';
  occurredAt: string;
  reason?: string;
}

export interface ProviderUsageSnapshot {
  sentToday: number;
  sentThisMonth: number;
}

export interface EmailProvider {
  name: string;
  isConfigured(): boolean;
  sendEmail(input: SendEmailInput): Promise<SendEmailResult>;
  /** Parses a provider's raw delivery-status webhook payload into normalized events. */
  parseStatusWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): EmailWebhookEvent[];
  getUsage(businessId: string): Promise<ProviderUsageSnapshot>;
}
