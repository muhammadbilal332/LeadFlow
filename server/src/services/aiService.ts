import { env } from '../config/env';
import { z } from 'zod';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('AI qualification is not configured. Add an AI provider API key to enable this feature.');
  }
}

export interface LeadForAi {
  name: string;
  company?: string | null;
  industry?: string | null;
  source?: string | null;
  interestedIn?: string | null;
  budget?: number | string | null;
  timeline?: string | null;
  description?: string | null;
}

export interface AiQualificationResult {
  score: number;
  qualification: 'Hot' | 'Warm' | 'Cold';
  summary: string;
  reasoning: string;
  recommendedAction: string;
  strengths: string;
  concerns: string;
  urgency: string;
  suggestedResponse: string;
  estimatedPriority: 'Low' | 'Medium' | 'High' | 'Hot';
}

const aiResultSchema = z.object({
  score: z.number().min(0).max(100),
  qualification: z.enum(['Hot', 'Warm', 'Cold']),
  summary: z.string(),
  reasoning: z.string(),
  recommended_action: z.string(),
  strengths: z.string().optional().default(''),
  concerns: z.string().optional().default(''),
  urgency: z.string().optional().default(''),
  suggested_response: z.string().optional().default(''),
  estimated_priority: z.enum(['Low', 'Medium', 'High', 'Hot']).optional().default('Medium'),
});

export function isAiConfigured(): boolean {
  if (env.AI_PROVIDER === 'openai') return Boolean(env.OPENAI_API_KEY);
  if (env.AI_PROVIDER === 'anthropic') return Boolean(env.ANTHROPIC_API_KEY);
  return false;
}

function buildPrompt(lead: LeadForAi): string {
  return `You are a sales qualification assistant for a CRM. Evaluate the following lead and return ONLY a JSON object (no markdown, no extra text) with this exact shape:
{"score": <integer 0-100>, "qualification": "Hot"|"Warm"|"Cold", "summary": "<one or two sentence summary>", "reasoning": "<brief reasoning covering business fit, budget, urgency, expressed interest, timeline, and completeness of information>", "recommended_action": "<one concrete next action for the salesperson>", "strengths": "<what makes this lead promising, or empty string if none>", "concerns": "<what makes this lead risky or unclear, or empty string if none>", "urgency": "<one short phrase describing how time-sensitive this lead is>", "suggested_response": "<a short draft opening line/message a salesperson could send this lead>", "estimated_priority": "Low"|"Medium"|"High"|"Hot"}

Lead information:
Name: ${lead.name}
Company: ${lead.company || 'Unknown'}
Industry: ${lead.industry || 'Unknown'}
Source: ${lead.source || 'Unknown'}
Interested in: ${lead.interestedIn || 'Not specified'}
Budget: ${lead.budget != null && lead.budget !== '' ? lead.budget : 'Not specified'}
Timeline: ${lead.timeline || 'Not specified'}
Description: ${lead.description || 'No additional details provided'}

Score 70-100 = Hot, 40-69 = Warm, 0-39 = Cold. Base the score on business fit, budget, urgency, expressed interest, timeline, and completeness of information. Return ONLY the JSON object.`;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) {
    throw new Error('AI response did not contain JSON');
  }
  return JSON.parse(text.slice(start, end + 1));
}

async function callOpenAi(prompt: string): Promise<unknown> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const content = data.choices?.[0]?.message?.content ?? '';
  return extractJson(content);
}

async function callAnthropic(prompt: string): Promise<unknown> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic request failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const textBlock = data.content?.find((b) => b.type === 'text');
  return extractJson(textBlock?.text ?? '');
}

export async function qualifyLeadWithAi(lead: LeadForAi): Promise<AiQualificationResult> {
  if (!isAiConfigured()) {
    throw new AiNotConfiguredError();
  }

  const prompt = buildPrompt(lead);
  const raw = env.AI_PROVIDER === 'openai' ? await callOpenAi(prompt) : await callAnthropic(prompt);
  const parsed = aiResultSchema.parse(raw);

  return {
    score: Math.round(parsed.score),
    qualification: parsed.qualification,
    summary: parsed.summary,
    reasoning: parsed.reasoning,
    recommendedAction: parsed.recommended_action,
    strengths: parsed.strengths,
    concerns: parsed.concerns,
    urgency: parsed.urgency,
    suggestedResponse: parsed.suggested_response,
    estimatedPriority: parsed.estimated_priority,
  };
}
