import { query } from '../db/pool';

export interface RoutingRuleRow {
  id: string;
  business_id: string;
  name: string;
  priority: number;
  field: 'source' | 'industry' | 'score' | 'always';
  operator: 'equals' | 'gte' | 'lte';
  value: string | null;
  assignment_type: 'user' | 'round_robin' | 'owner';
  assign_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listRoutingRules(businessId: string): Promise<RoutingRuleRow[]> {
  const result = await query<RoutingRuleRow>(
    `SELECT * FROM lead_routing_rules WHERE business_id = $1 ORDER BY priority ASC, created_at ASC`,
    [businessId]
  );
  return result.rows;
}

export async function listActiveRoutingRules(businessId: string): Promise<RoutingRuleRow[]> {
  const result = await query<RoutingRuleRow>(
    `SELECT * FROM lead_routing_rules WHERE business_id = $1 AND is_active = true ORDER BY priority ASC, created_at ASC`,
    [businessId]
  );
  return result.rows;
}

export async function findRoutingRule(id: string, businessId: string): Promise<RoutingRuleRow | null> {
  const result = await query<RoutingRuleRow>(`SELECT * FROM lead_routing_rules WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function createRoutingRule(input: {
  businessId: string;
  name: string;
  priority: number;
  field: string;
  operator: string;
  value?: string | null;
  assignmentType: string;
  assignUserId?: string | null;
}): Promise<RoutingRuleRow> {
  const result = await query<RoutingRuleRow>(
    `INSERT INTO lead_routing_rules (business_id, name, priority, field, operator, value, assignment_type, assign_user_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [input.businessId, input.name, input.priority, input.field, input.operator, input.value ?? null, input.assignmentType, input.assignUserId ?? null]
  );
  return result.rows[0];
}

export async function updateRoutingRule(
  id: string,
  businessId: string,
  input: Partial<{
    name: string;
    priority: number;
    field: string;
    operator: string;
    value: string | null;
    assignmentType: string;
    assignUserId: string | null;
    isActive: boolean;
  }>
): Promise<RoutingRuleRow | null> {
  const columnMap: Record<string, string> = {
    name: 'name',
    priority: 'priority',
    field: 'field',
    operator: 'operator',
    value: 'value',
    assignmentType: 'assignment_type',
    assignUserId: 'assign_user_id',
    isActive: 'is_active',
  };
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      fields.push(`${columnMap[key]} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    return findRoutingRule(id, businessId);
  }

  values.push(id, businessId);
  const result = await query<RoutingRuleRow>(
    `UPDATE lead_routing_rules SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteRoutingRule(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM lead_routing_rules WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}

export async function getNextRoundRobinUser(businessId: string): Promise<string | null> {
  const salesUsers = await query<{ id: string }>(
    `SELECT id FROM users WHERE business_id = $1 AND role = 'sales' AND is_active = true ORDER BY created_at ASC`,
    [businessId]
  );
  if (salesUsers.rows.length === 0) return null;

  const cursor = await query<{ last_assigned_user_id: string | null }>(
    `SELECT last_assigned_user_id FROM round_robin_cursors WHERE business_id = $1`,
    [businessId]
  );

  const ids = salesUsers.rows.map((r) => r.id);
  const lastId = cursor.rows[0]?.last_assigned_user_id ?? null;
  const lastIndex = lastId ? ids.indexOf(lastId) : -1;
  const nextIndex = (lastIndex + 1) % ids.length;
  const nextUserId = ids[nextIndex];

  await query(
    `INSERT INTO round_robin_cursors (business_id, last_assigned_user_id, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (business_id) DO UPDATE SET last_assigned_user_id = EXCLUDED.last_assigned_user_id, updated_at = now()`,
    [businessId, nextUserId]
  );

  return nextUserId;
}

export interface SlaSettingsRow {
  business_id: string;
  hot_minutes: number;
  high_minutes: number;
  medium_minutes: number;
  low_minutes: number;
  updated_at: string;
}

const DEFAULT_SLA: Omit<SlaSettingsRow, 'business_id' | 'updated_at'> = {
  hot_minutes: 15,
  high_minutes: 30,
  medium_minutes: 120,
  low_minutes: 1440,
};

export async function getSlaSettings(businessId: string): Promise<SlaSettingsRow> {
  const result = await query<SlaSettingsRow>(`SELECT * FROM sla_settings WHERE business_id = $1`, [businessId]);
  if (result.rows[0]) return result.rows[0];
  return { business_id: businessId, updated_at: new Date().toISOString(), ...DEFAULT_SLA };
}

export async function upsertSlaSettings(
  businessId: string,
  input: Partial<{ hotMinutes: number; highMinutes: number; mediumMinutes: number; lowMinutes: number }>
): Promise<SlaSettingsRow> {
  const current = await getSlaSettings(businessId);
  const merged = {
    hot_minutes: input.hotMinutes ?? current.hot_minutes,
    high_minutes: input.highMinutes ?? current.high_minutes,
    medium_minutes: input.mediumMinutes ?? current.medium_minutes,
    low_minutes: input.lowMinutes ?? current.low_minutes,
  };
  const result = await query<SlaSettingsRow>(
    `INSERT INTO sla_settings (business_id, hot_minutes, high_minutes, medium_minutes, low_minutes, updated_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (business_id) DO UPDATE SET
       hot_minutes = EXCLUDED.hot_minutes, high_minutes = EXCLUDED.high_minutes,
       medium_minutes = EXCLUDED.medium_minutes, low_minutes = EXCLUDED.low_minutes, updated_at = now()
     RETURNING *`,
    [businessId, merged.hot_minutes, merged.high_minutes, merged.medium_minutes, merged.low_minutes]
  );
  return result.rows[0];
}
