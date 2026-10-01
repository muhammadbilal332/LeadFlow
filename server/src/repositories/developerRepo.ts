import { query } from '../db/pool';

export interface PlatformOverview {
  totalBusinesses: number;
  totalUsers: number;
  totalLeads: number;
  activeCampaigns: number;
  emailsSent: number;
  emailsQueued: number;
  repliesReceived: number;
  convertedLeads: number;
  failedEmails: number;
  suppressedContacts: number;
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const [businesses, users, leads, campaigns, sent, queued, replies, converted, failed, suppressed] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM businesses`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM users`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM leads`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM outreach_campaigns WHERE status = 'running'`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM outreach_messages WHERE status IN ('sent', 'delivered')`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM outreach_messages WHERE status = 'queued'`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM email_replies`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM leads WHERE status = 'Won'`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM outreach_messages WHERE status = 'failed'`),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM suppressions`),
  ]);

  const n = (r: { rows: { count: string }[] }) => Number(r.rows[0]?.count ?? 0);

  return {
    totalBusinesses: n(businesses),
    totalUsers: n(users),
    totalLeads: n(leads),
    activeCampaigns: n(campaigns),
    emailsSent: n(sent),
    emailsQueued: n(queued),
    repliesReceived: n(replies),
    convertedLeads: n(converted),
    failedEmails: n(failed),
    suppressedContacts: n(suppressed),
  };
}

export async function getLeadsOverTime(days: number): Promise<Array<{ date: string; count: number }>> {
  const result = await query<{ date: string; count: string }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, COUNT(*)::text AS count
     FROM leads WHERE created_at >= now() - ($1 || ' days')::interval
     GROUP BY date_trunc('day', created_at)
     ORDER BY date_trunc('day', created_at)`,
    [days]
  );
  return result.rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export async function getEmailsOverTime(days: number): Promise<Array<{ date: string; count: number }>> {
  const result = await query<{ date: string; count: string }>(
    `SELECT to_char(date_trunc('day', sent_at), 'YYYY-MM-DD') AS date, COUNT(*)::text AS count
     FROM outreach_messages WHERE sent_at IS NOT NULL AND sent_at >= now() - ($1 || ' days')::interval
     GROUP BY date_trunc('day', sent_at)
     ORDER BY date_trunc('day', sent_at)`,
    [days]
  );
  return result.rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export async function getRepliesOverTime(days: number): Promise<Array<{ date: string; count: number }>> {
  const result = await query<{ date: string; count: string }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, COUNT(*)::text AS count
     FROM email_replies WHERE created_at >= now() - ($1 || ' days')::interval
     GROUP BY date_trunc('day', created_at)
     ORDER BY date_trunc('day', created_at)`,
    [days]
  );
  return result.rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export interface BusinessSummary {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  owner_name: string | null;
  owner_email: string | null;
  user_count: number;
  lead_count: number;
  campaign_count: number;
  created_at: string;
}

/** Every owner, one row per business (the earliest-created owner wins ties) — computed separately and merged in JS, since pg-mem (the test harness) doesn't support correlated subqueries in a SELECT list. Real Postgres/Supabase would handle the single-query version fine, but this two-query approach is simpler and equally correct either way. */
async function getFirstOwnerByBusiness(): Promise<Map<string, { name: string; email: string }>> {
  const result = await query<{ business_id: string; name: string; email: string }>(
    `SELECT business_id, name, email FROM users WHERE role = 'owner' ORDER BY created_at ASC`
  );
  const map = new Map<string, { name: string; email: string }>();
  for (const row of result.rows) {
    if (!map.has(row.business_id)) map.set(row.business_id, { name: row.name, email: row.email });
  }
  return map;
}

export async function listBusinesses(): Promise<BusinessSummary[]> {
  const [result, owners] = await Promise.all([
    query<Omit<BusinessSummary, 'owner_name' | 'owner_email'>>(
      `SELECT
         b.id, b.name, b.slug, b.is_active, b.created_at,
         COALESCE(uc.count, 0)::int as user_count,
         COALESCE(lc.count, 0)::int as lead_count,
         COALESCE(cc.count, 0)::int as campaign_count
       FROM businesses b
       LEFT JOIN (SELECT business_id, COUNT(*) as count FROM users GROUP BY business_id) uc ON uc.business_id = b.id
       LEFT JOIN (SELECT business_id, COUNT(*) as count FROM leads GROUP BY business_id) lc ON lc.business_id = b.id
       LEFT JOIN (SELECT business_id, COUNT(*) as count FROM outreach_campaigns GROUP BY business_id) cc ON cc.business_id = b.id
       ORDER BY b.created_at DESC`
    ),
    getFirstOwnerByBusiness(),
  ]);

  return result.rows.map((row) => ({ ...row, owner_name: owners.get(row.id)?.name ?? null, owner_email: owners.get(row.id)?.email ?? null }));
}

export interface BusinessDetail extends BusinessSummary {
  email: string | null;
  phone: string | null;
  industry: string | null;
}

export async function getBusinessDetail(id: string): Promise<BusinessDetail | null> {
  const [result, owners] = await Promise.all([
    query<Omit<BusinessDetail, 'owner_name' | 'owner_email'>>(
      `SELECT
         b.id, b.name, b.slug, b.email, b.phone, b.industry, b.is_active, b.created_at,
         COALESCE(uc.count, 0)::int as user_count,
         COALESCE(lc.count, 0)::int as lead_count,
         COALESCE(cc.count, 0)::int as campaign_count
       FROM businesses b
       LEFT JOIN (SELECT business_id, COUNT(*) as count FROM users WHERE business_id = $1 GROUP BY business_id) uc ON uc.business_id = b.id
       LEFT JOIN (SELECT business_id, COUNT(*) as count FROM leads WHERE business_id = $1 GROUP BY business_id) lc ON lc.business_id = b.id
       LEFT JOIN (SELECT business_id, COUNT(*) as count FROM outreach_campaigns WHERE business_id = $1 GROUP BY business_id) cc ON cc.business_id = b.id
       WHERE b.id = $1`,
      [id]
    ),
    getFirstOwnerByBusiness(),
  ]);

  const row = result.rows[0];
  if (!row) return null;
  return { ...row, owner_name: owners.get(row.id)?.name ?? null, owner_email: owners.get(row.id)?.email ?? null };
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  business_id: string;
  business_name: string;
}

export async function listAllUsers(): Promise<PlatformUser[]> {
  const result = await query<PlatformUser>(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.business_id, b.name as business_name
     FROM users u JOIN businesses b ON b.id = u.business_id
     ORDER BY u.created_at DESC`
  );
  return result.rows;
}

export interface PlatformLead {
  id: string;
  name: string;
  company: string | null;
  business_id: string;
  business_name: string;
  source: string;
  status: string;
  score: number;
  assigned_user_name: string | null;
  created_at: string;
}

export interface PlatformLeadFilters {
  search?: string;
  businessId?: string;
  status?: string;
  page: number;
  pageSize: number;
}

export async function listAllLeads(filters: PlatformLeadFilters): Promise<{ rows: PlatformLead[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.search) {
    params.push(`%${filters.search.toLowerCase()}%`);
    conditions.push(`(LOWER(l.name) LIKE $${params.length} OR LOWER(l.company) LIKE $${params.length} OR LOWER(l.email) LIKE $${params.length})`);
  }
  if (filters.businessId) {
    params.push(filters.businessId);
    conditions.push(`l.business_id = $${params.length}`);
  }
  if (filters.status) {
    params.push(filters.status);
    conditions.push(`l.status = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM leads l ${where}`, params);

  const limit = filters.pageSize;
  const offset = (filters.page - 1) * filters.pageSize;
  params.push(limit, offset);

  const result = await query<PlatformLead>(
    `SELECT l.id, l.name, l.company, l.business_id, b.name as business_name, l.source, l.status, l.score,
            u.name as assigned_user_name, l.created_at
     FROM leads l
     JOIN businesses b ON b.id = l.business_id
     LEFT JOIN users u ON u.id = l.assigned_user_id
     ${where}
     ORDER BY l.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { rows: result.rows, total: Number(countResult.rows[0]?.count ?? 0) };
}

export interface OutreachLifecycleStats {
  draft: number;
  approved: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  bounced: number;
  replied: number;
}

export async function getOutreachLifecycleStats(): Promise<OutreachLifecycleStats> {
  const [drafts, messages] = await Promise.all([
    query<{ status: string; count: string }>(`SELECT status, COUNT(*)::text as count FROM outreach_drafts GROUP BY status`),
    query<{ status: string; count: string }>(`SELECT status, COUNT(*)::text as count FROM outreach_messages GROUP BY status`),
  ]);

  const draftCounts: Record<string, number> = {};
  for (const r of drafts.rows) draftCounts[r.status] = Number(r.count);
  const messageCounts: Record<string, number> = {};
  for (const r of messages.rows) messageCounts[r.status] = Number(r.count);

  const repliedResult = await query<{ count: string }>(`SELECT COUNT(*)::text as count FROM email_replies`);

  return {
    draft: draftCounts.draft ?? 0,
    approved: draftCounts.approved ?? 0,
    queued: messageCounts.queued ?? 0,
    sent: messageCounts.sent ?? 0,
    delivered: messageCounts.delivered ?? 0,
    failed: messageCounts.failed ?? 0,
    bounced: messageCounts.bounced ?? 0,
    replied: Number(repliedResult.rows[0]?.count ?? 0),
  };
}

export interface RecentCampaignSummary {
  id: string;
  name: string;
  status: string;
  business_name: string;
  created_at: string;
}

export async function listRecentCampaigns(limit = 20): Promise<RecentCampaignSummary[]> {
  const result = await query<RecentCampaignSummary>(
    `SELECT c.id, c.name, c.status, b.name as business_name, c.created_at
     FROM outreach_campaigns c JOIN businesses b ON b.id = c.business_id
     ORDER BY c.created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
}
