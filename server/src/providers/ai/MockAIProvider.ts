import { AIProvider, ContactContext, GeneratedEmail, SenderVoice, SequenceStepContext } from './AIProvider';

/**
 * Deterministic, template-based "personalization" that only ever uses
 * fields it was actually given. It cannot invent facts because it has no
 * generative capability at all — every sentence is built from a supplied
 * field or omitted if that field is empty. This is intentionally the
 * strictest possible guarantee against fabrication, and it's what runs by
 * default (OUTREACH_AI_PROVIDER=mock) so the full pipeline works with zero
 * external calls or cost.
 */
export class MockAIProvider implements AIProvider {
  name = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async generateEmail(contact: ContactContext, step: SequenceStepContext, voice: SenderVoice): Promise<GeneratedEmail> {
    const firstName = (contact.contactName || '').trim().split(/\s+/)[0] || null;
    const greeting = firstName ? `Hi ${firstName},` : 'Hi there,';
    const company = contact.companyName || contact.brandName;

    const lines: string[] = [greeting, ''];

    if (step.isFollowUp) {
      lines.push(`Just following up on my note below${company ? ` — wanted to check if it landed with you at ${company}` : ''}.`);
    } else if (company && contact.painPoints) {
      lines.push(`I came across ${company} and noticed ${this.lowerFirst(contact.painPoints)}.`);
    } else if (company) {
      lines.push(`I came across ${company} and wanted to reach out.`);
    } else {
      lines.push(`I wanted to reach out directly.`);
    }

    if (contact.possibleSolution) {
      lines.push('', `${voice.businessName} helps with exactly that — ${this.lowerFirst(contact.possibleSolution)}.`);
    }

    if (contact.industry && !step.isFollowUp) {
      lines.push('', `We work with a number of ${contact.industry} teams, so this is squarely in our lane.`);
    }

    lines.push('', `Worth a quick 15-minute call this week to see if it's a fit?`);
    lines.push('', voice.senderName);

    const body = lines.join('\n');
    const subject = step.isFollowUp
      ? `Re: ${company ? `Quick follow-up for ${company}` : 'Quick follow-up'}`
      : company
        ? `Quick question for ${company}`
        : 'Quick question';

    return { subject, body };
  }

  private lowerFirst(text: string): string {
    const trimmed = text.trim();
    return trimmed ? trimmed[0].toLowerCase() + trimmed.slice(1) : trimmed;
  }
}
