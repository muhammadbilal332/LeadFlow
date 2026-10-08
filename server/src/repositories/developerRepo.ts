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
