import { env } from '../../config/env';
import { AIProvider, ContactContext, GeneratedEmail, SenderVoice, SequenceStepContext } from './AIProvider';

/**
 * Real provider, reusing the same OPENAI_API_KEY already used by the lead
 * qualification feature. Only used when OUTREACH_AI_PROVIDER=openai; the
 * prompt explicitly forbids inventing facts not present in the contact
 * context, as defense in depth alongside the Natural Communication Engine's
 * post-processing (naturalCommunicationEngine.ts) and the Quality Check
 * Service that runs on every draft before it can be approved.
 */
export class OpenAIProvider implements AIProvider {
  name = 'openai';

  isConfigured(): boolean {
    return Boolean(env.OPENAI_API_KEY);
  }

  async generateEmail(contact: ContactContext, step: SequenceStepContext, voice: SenderVoice): Promise<GeneratedEmail> {
    if (!this.isConfigured()) {
      throw new Error('OpenAI outreach provider is not configured (missing OPENAI_API_KEY)');
    }

    const prompt = this.buildPrompt(contact, step, voice);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI outreach request failed (${res.status}): ${body}`);
    }

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { subject?: string; body?: string };
    if (!parsed.subject || !parsed.body) {
      throw new Error('OpenAI outreach response was missing subject/body');
    }
    return { subject: parsed.subject, body: parsed.body };
  }

  private buildPrompt(contact: ContactContext, step: SequenceStepContext, voice: SenderVoice): string {
    return `You are writing a short, natural, personal cold outreach email on behalf of ${voice.businessName}, sent by ${voice.senderName}.

CRITICAL RULES:
- Use ONLY the facts given below. Never invent details about the recipient's company, role, needs, or history.
- If a fact is missing, omit it rather than guessing or generalizing.
- Sound like a real person wrote it in under two minutes: short sentences, no corporate jargon ("synergy", "leverage", "circle back", "touch base", "reaching out to connect"), no exclamation-mark enthusiasm.
- 60-120 words. One clear call to action at the end (e.g. a short call).
- This is step ${step.stepOrder} of ${step.totalSteps} in the sequence${step.isFollowUp ? ' — this is a brief follow-up to an earlier unanswered email, not a repeat pitch' : ''}.
${voice.voiceDescription ? `- Match this voice/tone: ${voice.voiceDescription}` : ''}

Recipient facts:
Name: ${contact.contactName || 'Unknown'}
Company: ${contact.companyName || contact.brandName || 'Unknown'}
Industry: ${contact.industry || 'Unknown'}
Pain points: ${contact.painPoints || 'Not specified'}
Our possible solution: ${contact.possibleSolution || 'Not specified'}
Notes: ${contact.notes || 'None'}

Return ONLY a JSON object: {"subject": "<short subject line>", "body": "<email body, plain text, no signature block beyond the sender's first name>"}`;
  }
}
