import { query } from '../db/pool';

export interface FollowUpRow {
  id: string;
  business_id: string;
  lead_id: string;
  user_id: string | null;
  type: string;
  scheduled_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  lead_name?: string;
  user_name?: string | null;
}

export interface FollowUpFilters {
  status?: 'upcoming' | 'overdue' | 'completed' | 'all';
  restrictToUserId?: string;
}

export async function createFollowUp(input: {
  businessId: string;
  leadId: string;
  userId?: string | null;
  type: string;
  scheduledAt: string;
  notes?: string | null;
}): Promise<FollowUpRow> {
  const result = await query<FollowUpRow>(
    `INSERT INTO follow_ups (business_id, lead_id, user_id, type, scheduled_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [input.businessId, input.leadId, input.userId ?? null, input.type, input.scheduledAt, input.notes ?? null]
  );
  return result.rows[0];
}

export async function listFollowUps(businessId: string, filters: FollowUpFilters): Promise<FollowUpRow[]> {
  const conditions = ['f.business_id = $1'];
  const values: unknown[] = [businessId];
  let idx = 2;

  if (filters.restrictToUserId) {
    conditions.push(`f.user_id = $${idx++}`);
    values.push(filters.restrictToUserId);
  }

  if (filters.status === 'upcoming') {
    conditions.push('f.completed_at IS NULL AND f.scheduled_at >= now()');
  } else if (filters.status === 'overdue') {
    conditions.push('f.completed_at IS NULL AND f.scheduled_at < now()');
  } else if (filters.status === 'completed') {
    conditions.push('f.completed_at IS NOT NULL');
  }

  const result = await query<FollowUpRow>(
    `SELECT f.*, l.name AS lead_name, u.name AS user_name
     FROM follow_ups f
     JOIN leads l ON l.id = f.lead_id
     LEFT JOIN users u ON u.id = f.user_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY f.scheduled_at ASC`,
    values
  );
  return result.rows;
}

export async function listFollowUpsForLead(leadId: string, businessId: string): Promise<FollowUpRow[]> {
  const result = await query<FollowUpRow>(
    `SELECT f.*, u.name AS user_name
     FROM follow_ups f
     LEFT JOIN users u ON u.id = f.user_id
     WHERE f.lead_id = $1 AND f.business_id = $2
     ORDER BY f.scheduled_at ASC`,
    [leadId, businessId]
  );
  return result.rows;
}

export async function findFollowUpById(id: string, businessId: string): Promise<FollowUpRow | null> {
  const result = await query<FollowUpRow>(`SELECT * FROM follow_ups WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

export async function updateFollowUp(
  id: string,
  businessId: string,
  input: Partial<{ type: string; scheduledAt: string; notes: string | null; completedAt: string | null }>
): Promise<FollowUpRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.type !== undefined) {
    fields.push(`type = $${idx++}`);
    values.push(input.type);
  }
  if (input.scheduledAt !== undefined) {
    fields.push(`scheduled_at = $${idx++}`);
    values.push(input.scheduledAt);
  }
  if (input.notes !== undefined) {
    fields.push(`notes = $${idx++}`);
    values.push(input.notes);
  }
  if (input.completedAt !== undefined) {
    fields.push(`completed_at = $${idx++}`);
    values.push(input.completedAt);
  }

  if (fields.length === 0) {
    return findFollowUpById(id, businessId);
  }

  values.push(id, businessId);
  const result = await query<FollowUpRow>(
    `UPDATE follow_ups SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function countDueFollowUps(businessId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM follow_ups WHERE business_id = $1 AND completed_at IS NULL AND scheduled_at < now() + interval '1 day'`,
    [businessId]
  );
  return Number(result.rows[0]?.count ?? 0);
}
