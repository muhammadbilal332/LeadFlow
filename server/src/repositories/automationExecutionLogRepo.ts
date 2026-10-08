import { query } from '../db/pool';

export interface AutomationExecutionLogRow {
  id: string;
  business_id: string | null;
  triggered_by: 'api_key' | 'jwt';
  status: 'success' | 'failure';
  drafts_generated: number;
  sent: number;
  blocked: number;
  failed: number;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

export async function recordExecution(input: {
  businessId: string | null;
  triggeredBy: 'api_key' | 'jwt';
  status: 'success' | 'failure';
  draftsGenerated?: number;
  sent?: number;
  blocked?: number;
  failed?: number;
  error?: string | null;
  durationMs?: number;
}): Promise<void> {
  await query(
    `INSERT INTO automation_execution_logs (business_id, triggered_by, status, drafts_generated, sent, blocked, failed, error, duration_ms)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.businessId,
      input.triggeredBy,
      input.status,
      input.draftsGenerated ?? 0,
      input.sent ?? 0,
      input.blocked ?? 0,
      input.failed ?? 0,
      input.error ?? null,
      input.durationMs ?? null,
    ]
  );
}

export async function listRecent(limit = 50): Promise<AutomationExecutionLogRow[]> {
  const result = await query<AutomationExecutionLogRow>(`SELECT * FROM automation_execution_logs ORDER BY created_at DESC LIMIT $1`, [limit]);
  return result.rows;
}

export interface AutomationExecutionSummary {
  lastExecutionAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  totalExecutions: number;
  apiKeyExecutionsLast24h: number;
}

/** Connection status is derived from real recent executions triggered by an API key (i.e. the external scheduler itself, not the UI's manual button) — never assumed just because the endpoint exists. */
export async function getSummary(): Promise<AutomationExecutionSummary> {
  const [lastAny, lastSuccess, lastFailure, totalCount, recentApiKeyCount] = await Promise.all([
    query<{ created_at: string }>(`SELECT created_at FROM automation_execution_logs ORDER BY created_at DESC LIMIT 1`),
    query<{ created_at: string }>(`SELECT created_at FROM automation_execution_logs WHERE status = 'success' ORDER BY created_at DESC LIMIT 1`),
    query<{ created_at: string }>(`SELECT created_at FROM automation_execution_logs WHERE status = 'failure' ORDER BY created_at DESC LIMIT 1`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM automation_execution_logs`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM automation_execution_logs WHERE triggered_by = 'api_key' AND created_at > now() - interval '24 hours'`),
  ]);

  return {
    lastExecutionAt: lastAny.rows[0]?.created_at ?? null,
    lastSuccessAt: lastSuccess.rows[0]?.created_at ?? null,
    lastFailureAt: lastFailure.rows[0]?.created_at ?? null,
    totalExecutions: Number(totalCount.rows[0]?.count ?? 0),
    apiKeyExecutionsLast24h: Number(recentApiKeyCount.rows[0]?.count ?? 0),
  };
}
