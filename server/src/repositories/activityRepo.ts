import { query } from '../db/pool';

export interface ActivityRow {
  id: string;
  business_id: string;
  lead_id: string;
  user_id: string | null;
  type: string;
  description: string;
  created_at: string;
  user_name?: string | null;
}

export async function createActivity(input: {
  businessId: string;
  leadId: string;
  userId?: string | null;
  type: string;
  description: string;
}): Promise<ActivityRow> {
  const result = await query<ActivityRow>(
    `INSERT INTO activities (business_id, lead_id, user_id, type, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.businessId, input.leadId, input.userId ?? null, input.type, input.description]
  );
  return result.rows[0];
}

export async function listActivitiesForLead(leadId: string, businessId: string): Promise<ActivityRow[]> {
  const result = await query<ActivityRow>(
    `SELECT a.*, u.name AS user_name
     FROM activities a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.lead_id = $1 AND a.business_id = $2
     ORDER BY a.created_at DESC`,
    [leadId, businessId]
  );
  return result.rows;
}
