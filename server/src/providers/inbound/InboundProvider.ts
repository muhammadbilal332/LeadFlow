export interface InboundEmailEvent {
  providerReplyId: string;
  providerMessageId: string | null;
  fromEmail: string;
  toEmail: string;
  subject: string | null;
  body: string;
  receivedAt: string;
}

export interface InboundProvider {
  name: string;
  isConfigured(): boolean;
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;
  parseWebhook(rawBody: Buffer): InboundEmailEvent[];
}
