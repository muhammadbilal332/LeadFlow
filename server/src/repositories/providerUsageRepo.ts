import { query } from '../db/pool';

export interface ProviderUsageRow {
  id: string;
  business_id: string;
  provider: string;
  period: 'daily' | 'monthly';
  period_key: string;
  sent_count: number;
  failed_count: number;
  bounced_count: number;
  updated_at: string;
}

async function bump(businessId: string, provider: string, period: 'daily' | 'monthly', periodKey: string, field: 'sent_count' | 'failed_count' | 'bounced_count'): Promise<void> {
  const existing = await query<ProviderUsageRow>(
    `SELECT * FROM provider_usage WHERE business_id = $1 AND provider = $2 AND period = $3 AND period_key = $4`,
    [businessId, provider, period, periodKey]
  );
  if (existing.rows[0]) {
    await query(`UPDATE provider_usage SET ${field} = ${field} + 1, updated_at = now() WHERE id = $1`, [existing.rows[0].id]);
    return;
  }
  const counts = { sent_count: 0, failed_count: 0, bounced_count: 0, [field]: 1 };
  await query(
    `INSERT INTO provider_usage (business_id, provider, period, period_key, sent_count, failed_count, bounced_count) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [businessId, provider, period, periodKey, counts.sent_count, counts.failed_count, counts.bounced_count]
  );
}

export async function recordSend(businessId: string, provider: string, outcome: 'sent' | 'failed' | 'bounced'): Promise<void> {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const month = now.toISOString().slice(0, 7);
  const field = outcome === 'sent' ? 'sent_count' : outcome === 'failed' ? 'failed_count' : 'bounced_count';
  await bump(businessId, provider, 'daily', day, field);
  await bump(businessId, provider, 'monthly', month, field);
}

export async function getDailyCount(businessId: string, provider: string, day: string): Promise<number> {
  const result = await query<{ sent_count: number }>(
    `SELECT sent_count FROM provider_usage WHERE business_id = $1 AND provider = $2 AND period = 'daily' AND period_key = $3`,
    [businessId, provider, day]
  );
  return result.rows[0]?.sent_count ?? 0;
}

export async function getUsageSummary(businessId: string, provider: string): Promise<{ sentToday: number; sentThisMonth: number; failedThisMonth: number; bouncedThisMonth: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const [dailyResult, monthlyResult] = await Promise.all([
    query<ProviderUsageRow>(`SELECT * FROM provider_usage WHERE business_id = $1 AND provider = $2 AND period = 'daily' AND period_key = $3`, [businessId, provider, day]),
    query<ProviderUsageRow>(`SELECT * FROM provider_usage WHERE business_id = $1 AND provider = $2 AND period = 'monthly' AND period_key = $3`, [businessId, provider, month]),
  ]);
  return {
    sentToday: dailyResult.rows[0]?.sent_count ?? 0,
    sentThisMonth: monthlyResult.rows[0]?.sent_count ?? 0,
    failedThisMonth: monthlyResult.rows[0]?.failed_count ?? 0,
    bouncedThisMonth: monthlyResult.rows[0]?.bounced_count ?? 0,
  };
}
