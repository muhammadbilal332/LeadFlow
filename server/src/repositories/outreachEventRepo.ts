import { query } from '../db/pool';

export type EventType = 'queued' | 'sent' | 'delivered' | 'opened' | 'bounced' | 'failed' | 'reply' | 'complaint';

export interface OutreachEventRow {
  id: string;
  business_id: string;
  message_id: string | null;
  type: EventType;
  payload: Record<string, unknown>;
  created_at: string;
}

export async function recordEvent(input: { businessId: string; messageId?: string | null; type: EventType; payload?: Record<string, unknown> }): Promise<OutreachEventRow> {
  const result = await query<OutreachEventRow>(
    `INSERT INTO outreach_events (business_id, message_id, type, payload) VALUES ($1,$2,$3,$4) RETURNING *`,
    [input.businessId, input.messageId ?? null, input.type, JSON.stringify(input.payload ?? {})]
  );
  return result.rows[0];
}

export async function listForMessage(messageId: string): Promise<OutreachEventRow[]> {
  const result = await query<OutreachEventRow>(`SELECT * FROM outreach_events WHERE message_id = $1 ORDER BY created_at ASC`, [messageId]);
  return result.rows;
}

export async function listForBusiness(businessId: string, limit = 100): Promise<OutreachEventRow[]> {
  const result = await query<OutreachEventRow>(`SELECT * FROM outreach_events WHERE business_id = $1 ORDER BY created_at DESC LIMIT $2`, [businessId, limit]);
  return result.rows;
}
