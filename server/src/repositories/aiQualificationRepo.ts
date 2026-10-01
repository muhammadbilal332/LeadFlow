import { query } from '../db/pool';

export interface AiQualificationRow {
  id: string;
  business_id: string;
  lead_id: string;
  score: number;
  qualification: string;
  summary: string;
  reasoning: string;
  recommended_action: string;
  strengths: string | null;
  concerns: string | null;
  urgency: string | null;
  suggested_response: string | null;
  estimated_priority: string | null;
  created_at: string;
}

export async function createAiQualification(input: {
  businessId: string;
  leadId: string;
  score: number;
  qualification: string;
  summary: string;
  reasoning: string;
  recommendedAction: string;
  strengths?: string;
  concerns?: string;
  urgency?: string;
  suggestedResponse?: string;
  estimatedPriority?: string;
}): Promise<AiQualificationRow> {
  const result = await query<AiQualificationRow>(
    `INSERT INTO ai_qualifications (
       business_id, lead_id, score, qualification, summary, reasoning, recommended_action,
       strengths, concerns, urgency, suggested_response, estimated_priority
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [
      input.businessId,
      input.leadId,
      input.score,
      input.qualification,
      input.summary,
      input.reasoning,
      input.recommendedAction,
      input.strengths ?? null,
      input.concerns ?? null,
      input.urgency ?? null,
      input.suggestedResponse ?? null,
      input.estimatedPriority ?? null,
    ]
  );
  return result.rows[0];
}

export async function findLatestAiQualification(leadId: string, businessId: string): Promise<AiQualificationRow | null> {
  const result = await query<AiQualificationRow>(
    `SELECT * FROM ai_qualifications WHERE lead_id = $1 AND business_id = $2 ORDER BY created_at DESC LIMIT 1`,
    [leadId, businessId]
  );
  return result.rows[0] ?? null;
}
