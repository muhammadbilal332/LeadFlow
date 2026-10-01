import { query } from '../db/pool';

export async function logAudit(input: { businessId: string; actorUserId?: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> }): Promise<void> {
  await query(
    `INSERT INTO outreach_audit_logs (business_id, actor_user_id, action, entity_type, entity_id, metadata) VALUES ($1,$2,$3,$4,$5,$6)`,
    [input.businessId, input.actorUserId ?? null, input.action, input.entityType, input.entityId ?? null, JSON.stringify(input.metadata ?? {})]
  );
}
