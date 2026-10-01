import { query } from '../db/pool';

export interface DeveloperAuditLogRow {
  id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  business_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  result: 'success' | 'failure';
  created_at: string;
  actor_name?: string | null;
  actor_email?: string | null;
}

export async function logDeveloperAction(input: {
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  businessId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  result?: 'success' | 'failure';
}): Promise<void> {
  await query(
    `INSERT INTO developer_audit_logs (actor_user_id, action, target_type, target_id, business_id, metadata, ip_address, result)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      input.actorUserId,
      input.action,
      input.targetType,
      input.targetId ?? null,
      input.businessId ?? null,
      JSON.stringify(input.metadata ?? {}),
      input.ipAddress ?? null,
      input.result ?? 'success',
    ]
  );
}

export async function listAuditLogs(limit = 100): Promise<DeveloperAuditLogRow[]> {
  const result = await query<DeveloperAuditLogRow>(
    `SELECT dal.*, u.name as actor_name, u.email as actor_email
     FROM developer_audit_logs dal
     LEFT JOIN users u ON u.id = dal.actor_user_id
     ORDER BY dal.created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
