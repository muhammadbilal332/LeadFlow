import { query } from '../db/pool';

export async function logGeneration(input: { businessId: string; campaignContactId?: string | null; provider: string; promptSummary: string; outputSummary: string }): Promise<void> {
  await query(
    `INSERT INTO ai_generation_logs (business_id, campaign_contact_id, provider, prompt_summary, output_summary) VALUES ($1,$2,$3,$4,$5)`,
    [input.businessId, input.campaignContactId ?? null, input.provider, input.promptSummary, input.outputSummary]
  );
}
