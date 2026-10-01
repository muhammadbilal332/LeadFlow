import { query } from '../db/pool';

export type EventSeverity = 'info' | 'warning' | 'error';

export interface SystemEventRow {
  id: string;
  severity: EventSeverity;
  event_type: string;
  business_id: string | null;
  user_id: string | null;
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
  business_name?: string | null;
}

export async function logSystemEvent(input: {
  severity: EventSeverity;
  eventType: string;
  businessId?: string | null;
  userId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO system_events (severity, event_type, business_id, user_id, message, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.severity, input.eventType, input.businessId ?? null, input.userId ?? null, input.message, JSON.stringify(input.metadata ?? {})]
  );
}

export async function listSystemEvents(opts: { severity?: EventSeverity; limit?: number } = {}): Promise<SystemEventRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (opts.severity) {
    params.push(opts.severity);
    conditions.push(`se.severity = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(opts.limit ?? 100);

  const result = await query<SystemEventRow>(
    `SELECT se.*, b.name as business_name FROM system_events se
     LEFT JOIN businesses b ON b.id = se.business_id
     ${where}
     ORDER BY se.created_at DESC LIMIT $${params.length}`,
    params
  );
  return result.rows;
}
