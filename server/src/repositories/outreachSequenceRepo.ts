import { query } from '../db/pool';

export interface SequenceRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface SequenceStepRow {
  id: string;
  sequence_id: string;
  step_order: number;
  delay_days: number;
  subject_template: string;
  body_template: string | null;
  ai_personalize: boolean;
  is_enabled: boolean;
  created_at: string;
}

export async function listSequences(businessId: string): Promise<SequenceRow[]> {
  const result = await query<SequenceRow>(`SELECT * FROM outreach_sequences WHERE business_id = $1 ORDER BY created_at DESC`, [businessId]);
  return result.rows;
}

export async function findSequenceById(id: string, businessId: string): Promise<SequenceRow | null> {
  const result = await query<SequenceRow>(`SELECT * FROM outreach_sequences WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function createSequence(input: { businessId: string; name: string; description?: string | null }): Promise<SequenceRow> {
  const result = await query<SequenceRow>(
    `INSERT INTO outreach_sequences (business_id, name, description) VALUES ($1,$2,$3) RETURNING *`,
    [input.businessId, input.name, input.description ?? null]
  );
  return result.rows[0];
}

export async function updateSequence(id: string, businessId: string, input: { name?: string; description?: string | null }): Promise<SequenceRow | null> {
  const result = await query<SequenceRow>(
    `UPDATE outreach_sequences SET name = COALESCE($1, name), description = COALESCE($2, description), updated_at = now()
     WHERE id = $3 AND business_id = $4 RETURNING *`,
    [input.name ?? null, input.description ?? null, id, businessId]
  );
  return result.rows[0] ?? null;
}

/** Campaigns referencing this sequence have sequence_id set to NULL (ON DELETE SET NULL) rather than being deleted themselves. */
export async function deleteSequence(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM outreach_sequences WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}

export async function listSteps(sequenceId: string): Promise<SequenceStepRow[]> {
  const result = await query<SequenceStepRow>(`SELECT * FROM outreach_sequence_steps WHERE sequence_id = $1 ORDER BY step_order ASC`, [sequenceId]);
  return result.rows;
}

export async function replaceSteps(
  sequenceId: string,
  steps: Array<{ stepOrder: number; delayDays: number; subjectTemplate: string; bodyTemplate?: string | null; aiPersonalize?: boolean; isEnabled?: boolean }>
): Promise<SequenceStepRow[]> {
  await query(`DELETE FROM outreach_sequence_steps WHERE sequence_id = $1`, [sequenceId]);
  const created: SequenceStepRow[] = [];
  for (const step of steps) {
    const result = await query<SequenceStepRow>(
      `INSERT INTO outreach_sequence_steps (sequence_id, step_order, delay_days, subject_template, body_template, ai_personalize, is_enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [sequenceId, step.stepOrder, step.delayDays, step.subjectTemplate, step.bodyTemplate ?? null, step.aiPersonalize ?? true, step.isEnabled ?? true]
    );
    created.push(result.rows[0]);
  }
  return created;
}
