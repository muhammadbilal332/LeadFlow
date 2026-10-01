import { query } from '../db/pool';

export interface AutomationCondition {
  field: 'score' | 'source' | 'industry';
  operator: 'equals' | 'gte' | 'lte';
  value: string;
}

export type AutomationAction =
  | { type: 'assign_user'; userId: string }
  | { type: 'create_followup'; followUpType: string; minutes: number }
  | { type: 'notify'; userId?: string };

export interface AutomationRuleRow {
  id: string;
  business_id: string;
  name: string;
  trigger_event: 'lead_created';
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export async function listAutomationRules(businessId: string): Promise<AutomationRuleRow[]> {
  const result = await query<AutomationRuleRow>(
    `SELECT * FROM automation_rules WHERE business_id = $1 ORDER BY priority ASC, created_at ASC`,
    [businessId]
  );
  return result.rows;
}

export async function listActiveAutomationRules(businessId: string): Promise<AutomationRuleRow[]> {
  const result = await query<AutomationRuleRow>(
    `SELECT * FROM automation_rules WHERE business_id = $1 AND is_active = true ORDER BY priority ASC, created_at ASC`,
    [businessId]
  );
  return result.rows;
}

export async function findAutomationRule(id: string, businessId: string): Promise<AutomationRuleRow | null> {
  const result = await query<AutomationRuleRow>(`SELECT * FROM automation_rules WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function createAutomationRule(input: {
  businessId: string;
  name: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  priority?: number;
}): Promise<AutomationRuleRow> {
  const result = await query<AutomationRuleRow>(
    `INSERT INTO automation_rules (business_id, name, conditions, actions, priority)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [input.businessId, input.name, JSON.stringify(input.conditions), JSON.stringify(input.actions), input.priority ?? 0]
  );
  return result.rows[0];
}

export async function updateAutomationRule(
  id: string,
  businessId: string,
  input: Partial<{ name: string; conditions: AutomationCondition[]; actions: AutomationAction[]; priority: number; isActive: boolean }>
): Promise<AutomationRuleRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(input.name);
  }
  if (input.conditions !== undefined) {
    fields.push(`conditions = $${idx++}`);
    values.push(JSON.stringify(input.conditions));
  }
  if (input.actions !== undefined) {
    fields.push(`actions = $${idx++}`);
    values.push(JSON.stringify(input.actions));
  }
  if (input.priority !== undefined) {
    fields.push(`priority = $${idx++}`);
    values.push(input.priority);
  }
  if (input.isActive !== undefined) {
    fields.push(`is_active = $${idx++}`);
    values.push(input.isActive);
  }

  if (fields.length === 0) {
    return findAutomationRule(id, businessId);
  }

  values.push(id, businessId);
  const result = await query<AutomationRuleRow>(
    `UPDATE automation_rules SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteAutomationRule(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM automation_rules WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}
