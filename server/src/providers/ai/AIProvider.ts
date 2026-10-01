/**
 * AI provider for outreach email personalization. Deliberately separate
 * from services/aiService.ts (which powers lead qualification) — different
 * prompt shape, different output contract, and switched by a different env
 * var (OUTREACH_AI_PROVIDER) so the two features never interfere.
 *
 * The prompt/contract is deliberately constrained: the model may only use
 * facts supplied in `ContactContext` and must never invent details about
 * the recipient's company, needs, or history.
 */
export interface ContactContext {
  contactName: string | null;
  companyName: string | null;
  brandName: string | null;
  industry: string | null;
  website: string | null;
  location: string | null;
  painPoints: string | null;
  possibleSolution: string | null;
  notes: string | null;
}

export interface SequenceStepContext {
  stepOrder: number;
  totalSteps: number;
  subjectTemplate: string;
  bodyTemplate: string | null;
  isFollowUp: boolean;
}

export interface SenderVoice {
  businessName: string;
  senderName: string;
  voiceDescription: string | null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  generateEmail(contact: ContactContext, step: SequenceStepContext, voice: SenderVoice): Promise<GeneratedEmail>;
}
