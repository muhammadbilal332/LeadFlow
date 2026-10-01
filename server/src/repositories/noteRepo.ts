import { query } from '../db/pool';

export interface NoteRow {
  id: string;
  business_id: string;
  lead_id: string;
  user_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
}

export async function createNote(input: { businessId: string; leadId: string; userId?: string | null; content: string }): Promise<NoteRow> {
  const result = await query<NoteRow>(
    `WITH inserted AS (
       INSERT INTO notes (business_id, lead_id, user_id, content) VALUES ($1, $2, $3, $4) RETURNING *
     )
     SELECT inserted.*, u.name AS user_name FROM inserted LEFT JOIN users u ON u.id = inserted.user_id`,
    [input.businessId, input.leadId, input.userId ?? null, input.content]
  );
  return result.rows[0];
}

export async function listNotesForLead(leadId: string, businessId: string): Promise<NoteRow[]> {
  const result = await query<NoteRow>(
    `SELECT n.*, u.name AS user_name
     FROM notes n
     LEFT JOIN users u ON u.id = n.user_id
     WHERE n.lead_id = $1 AND n.business_id = $2
     ORDER BY n.created_at DESC`,
    [leadId, businessId]
  );
  return result.rows;
}
