import { query, withTransaction } from '../db/pool';

export interface LeadRow {
  id: string;
  business_id: string;
  assigned_user_id: string | null;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  industry: string | null;
  interested_in: string | null;
  budget: string | null;
  timeline: string | null;
  description: string | null;
  status: string;
  score: number;
  created_at: string;
  updated_at: string;
  source_detail: string | null;
  form_id: string | null;
  campaign_id: string | null;
  campaign: string | null;
  ad_set: string | null;
  ad: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  landing_page: string | null;
  referrer: string | null;
  captured_at: string | null;
  external_source: string | null;
  external_id: string | null;
  normalized_email: string | null;
  normalized_phone: string | null;
  duplicate_of_lead_id: string | null;
  merged_at: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Hot';
  first_contact_at: string | null;
  response_time_seconds: number | null;
  sla_due_at: string | null;
  sla_status: 'Pending' | 'Met' | 'Missed';
}

export interface LeadWithAssignee extends LeadRow {
  assigned_user_name: string | null;
}

export interface LeadFilters {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  source?: string;
  assignedUserId?: string;
  minScore?: number;
  maxScore?: number;
  priority?: string;
  campaignId?: string;
  slaStatus?: string;
  /** Inbox view: unworked leads (status New) that have not yet had a first contact recorded. */
  unworkedOnly?: boolean;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  /** When set, restricts results to leads assigned to this user (used for sales role scoping). */
  restrictToUserId?: string;
}

const SORT_COLUMNS: Record<string, string> = {
  created_at: 'l.created_at',
  name: 'l.name',
  score: 'l.score',
  status: 'l.status',
  company: 'l.company',
};

export async function listLeads(businessId: string, filters: LeadFilters): Promise<{ rows: LeadWithAssignee[]; total: number }> {
  const conditions: string[] = ['l.business_id = $1'];
  const values: unknown[] = [businessId];
  let idx = 2;

  if (filters.restrictToUserId) {
    conditions.push(`l.assigned_user_id = $${idx++}`);
    values.push(filters.restrictToUserId);
  }

  if (filters.search) {
    conditions.push(`(l.name ILIKE $${idx} OR l.company ILIKE $${idx} OR l.email ILIKE $${idx})`);
    values.push(`%${filters.search}%`);
    idx++;
  }

  if (filters.status) {
    conditions.push(`l.status = $${idx++}`);
    values.push(filters.status);
  }

  if (filters.source) {
    conditions.push(`l.source = $${idx++}`);
    values.push(filters.source);
  }

  if (filters.assignedUserId) {
    conditions.push(`l.assigned_user_id = $${idx++}`);
    values.push(filters.assignedUserId);
  }

  if (filters.minScore !== undefined) {
    conditions.push(`l.score >= $${idx++}`);
    values.push(filters.minScore);
  }

  if (filters.maxScore !== undefined) {
    conditions.push(`l.score <= $${idx++}`);
    values.push(filters.maxScore);
  }

  if (filters.priority) {
    conditions.push(`l.priority = $${idx++}`);
    values.push(filters.priority);
  }

  if (filters.campaignId) {
    conditions.push(`l.campaign_id = $${idx++}`);
    values.push(filters.campaignId);
  }

  if (filters.slaStatus) {
    conditions.push(`l.sla_status = $${idx++}`);
    values.push(filters.slaStatus);
  }

  if (filters.unworkedOnly) {
    conditions.push(`l.status = 'New' AND l.first_contact_at IS NULL AND l.duplicate_of_lead_id IS NULL`);
  }

  const whereClause = conditions.join(' AND ');
  const sortColumn = SORT_COLUMNS[filters.sortBy] ?? 'l.created_at';
  const sortDir = filters.sortDir === 'asc' ? 'ASC' : 'DESC';
  const offset = (filters.page - 1) * filters.pageSize;

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM leads l WHERE ${whereClause}`,
    values
  );

  const dataValues = [...values, filters.pageSize, offset];
  const dataResult = await query<LeadWithAssignee>(
    `SELECT l.*, u.name AS assigned_user_name
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_user_id
     WHERE ${whereClause}
     ORDER BY ${sortColumn} ${sortDir}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    dataValues
  );

  return { rows: dataResult.rows, total: Number(countResult.rows[0]?.count ?? 0) };
}

export async function findLeadById(id: string, businessId: string): Promise<LeadWithAssignee | null> {
  const result = await query<LeadWithAssignee>(
    `SELECT l.*, u.name AS assigned_user_name
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_user_id
     WHERE l.id = $1 AND l.business_id = $2`,
    [id, businessId]
  );
  return result.rows[0] ?? null;
}

export interface CreateLeadInput {
  businessId: string;
  assignedUserId?: string | null;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  industry?: string | null;
  interestedIn?: string | null;
  budget?: number | null;
  timeline?: string | null;
  description?: string | null;
  score: number;
  status?: string;
  sourceDetail?: string | null;
  formId?: string | null;
  campaignId?: string | null;
  campaign?: string | null;
  adSet?: string | null;
  ad?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  utmContent?: string | null;
  landingPage?: string | null;
  referrer?: string | null;
  externalSource?: string | null;
  externalId?: string | null;
  normalizedEmail?: string | null;
  normalizedPhone?: string | null;
  duplicateOfLeadId?: string | null;
  priority?: string;
  slaDueAt?: string | null;
}

export async function createLead(input: CreateLeadInput): Promise<LeadRow> {
  const result = await query<LeadRow>(
    `INSERT INTO leads (
      business_id, assigned_user_id, name, company, email, phone, source,
      industry, interested_in, budget, timeline, description, score, status,
      source_detail, form_id, campaign_id, campaign, ad_set, ad,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      landing_page, referrer, captured_at, external_source, external_id,
      normalized_email, normalized_phone, duplicate_of_lead_id, priority, sla_due_at
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
      $15,$16,$17,$18,$19,$20,
      $21,$22,$23,$24,$25,
      $26,$27, now(), $28,$29,
      $30,$31,$32,$33,$34
    )
    RETURNING *`,
    [
      input.businessId,
      input.assignedUserId ?? null,
      input.name,
      input.company ?? null,
      input.email ?? null,
      input.phone ?? null,
      input.source,
      input.industry ?? null,
      input.interestedIn ?? null,
      input.budget ?? null,
      input.timeline ?? null,
      input.description ?? null,
      input.score,
      input.status ?? 'New',
      input.sourceDetail ?? null,
      input.formId ?? null,
      input.campaignId ?? null,
      input.campaign ?? null,
      input.adSet ?? null,
      input.ad ?? null,
      input.utmSource ?? null,
      input.utmMedium ?? null,
      input.utmCampaign ?? null,
      input.utmTerm ?? null,
      input.utmContent ?? null,
      input.landingPage ?? null,
      input.referrer ?? null,
      input.externalSource ?? null,
      input.externalId ?? null,
      input.normalizedEmail ?? null,
      input.normalizedPhone ?? null,
      input.duplicateOfLeadId ?? null,
      input.priority ?? 'Medium',
      input.slaDueAt ?? null,
    ]
  );
  return result.rows[0];
}

/** Idempotency lookup for webhook-delivered leads. */
export async function findLeadByExternalId(businessId: string, externalSource: string, externalId: string): Promise<LeadRow | null> {
  const result = await query<LeadRow>(
    `SELECT * FROM leads WHERE business_id = $1 AND external_source = $2 AND external_id = $3`,
    [businessId, externalSource, externalId]
  );
  return result.rows[0] ?? null;
}

/** Finds the most recent non-duplicate lead matching by normalized email or phone, for duplicate detection. */
export async function findPotentialDuplicate(
  businessId: string,
  normalizedEmail: string | null,
  normalizedPhone: string | null
): Promise<LeadRow | null> {
  if (!normalizedEmail && !normalizedPhone) return null;

  const conditions: string[] = [];
  const values: unknown[] = [businessId];
  let idx = 2;

  if (normalizedEmail) {
    conditions.push(`normalized_email = $${idx++}`);
    values.push(normalizedEmail);
  }
  if (normalizedPhone) {
    conditions.push(`normalized_phone = $${idx++}`);
    values.push(normalizedPhone);
  }

  const result = await query<LeadRow>(
    `SELECT * FROM leads
     WHERE business_id = $1 AND duplicate_of_lead_id IS NULL AND (${conditions.join(' OR ')})
     ORDER BY created_at ASC LIMIT 1`,
    values
  );
  return result.rows[0] ?? null;
}

/** Leads that have been flagged as possible duplicates of another lead, pending staff review. */
export async function listPendingDuplicates(businessId: string): Promise<Array<LeadRow & { duplicate_of_name: string }>> {
  const result = await query<LeadRow & { duplicate_of_name: string }>(
    `SELECT l.*, o.name AS duplicate_of_name
     FROM leads l
     JOIN leads o ON o.id = l.duplicate_of_lead_id
     WHERE l.business_id = $1 AND l.duplicate_of_lead_id IS NOT NULL AND l.merged_at IS NULL
     ORDER BY l.created_at DESC`,
    [businessId]
  );
  return result.rows;
}

/**
 * Merges `sourceId` into `targetId`: moves notes/activities/follow-ups/quotations
 * to the target, marks the source as merged (never deleted, for audit history).
 */
export async function mergeLeads(sourceId: string, targetId: string, businessId: string): Promise<void> {
  await withTransaction(async (c) => {
    await c.query(`UPDATE notes SET lead_id = $1 WHERE lead_id = $2 AND business_id = $3`, [targetId, sourceId, businessId]);
    await c.query(`UPDATE activities SET lead_id = $1 WHERE lead_id = $2 AND business_id = $3`, [targetId, sourceId, businessId]);
    await c.query(
      `UPDATE follow_ups SET lead_id = $1 WHERE lead_id = $2 AND business_id = $3 AND completed_at IS NULL`,
      [targetId, sourceId, businessId]
    );
    await c.query(`UPDATE quotations SET lead_id = $1 WHERE lead_id = $2 AND business_id = $3`, [targetId, sourceId, businessId]);
    await c.query(
      `UPDATE leads SET duplicate_of_lead_id = $1, merged_at = now() WHERE id = $2 AND business_id = $3`,
      [targetId, sourceId, businessId]
    );
  });
}

export async function markFirstContact(id: string, businessId: string): Promise<LeadRow | null> {
  const existing = await query<LeadRow>(`SELECT * FROM leads WHERE id = $1 AND business_id = $2`, [id, businessId]);
  const lead = existing.rows[0];
  if (!lead) return null;

  const now = new Date();
  const firstContactAt = lead.first_contact_at ?? now.toISOString();
  const responseTimeSeconds =
    lead.response_time_seconds ?? Math.max(0, Math.round((now.getTime() - new Date(lead.created_at).getTime()) / 1000));
  const slaStatus =
    lead.sla_status === 'Pending'
      ? lead.sla_due_at && now.getTime() > new Date(lead.sla_due_at).getTime()
        ? 'Missed'
        : 'Met'
      : lead.sla_status;

  const result = await query<LeadRow>(
    `UPDATE leads SET first_contact_at = $1, response_time_seconds = $2, sla_status = $3
     WHERE id = $4 AND business_id = $5
     RETURNING *`,
    [firstContactAt, responseTimeSeconds, slaStatus, id, businessId]
  );
  return result.rows[0] ?? null;
}

export interface SlaMetrics {
  avgResponseSeconds: number | null;
  slaMetCount: number;
  slaMissedCount: number;
  slaPendingCount: number;
  overdueCount: number;
  complianceRate: number;
}

export async function slaMetrics(businessId: string): Promise<SlaMetrics> {
  const result = await query<{
    avg_response: string | null;
    met: string;
    missed: string;
    pending: string;
    overdue: string;
  }>(
    `SELECT
       AVG(response_time_seconds)::text AS avg_response,
       COALESCE(SUM(CASE WHEN sla_status = 'Met' THEN 1 ELSE 0 END), 0)::text AS met,
       COALESCE(SUM(CASE WHEN sla_status = 'Missed' THEN 1 ELSE 0 END), 0)::text AS missed,
       COALESCE(SUM(CASE WHEN sla_status = 'Pending' THEN 1 ELSE 0 END), 0)::text AS pending,
       COALESCE(SUM(CASE WHEN sla_status = 'Pending' AND sla_due_at IS NOT NULL AND sla_due_at < now() THEN 1 ELSE 0 END), 0)::text AS overdue
     FROM leads WHERE business_id = $1 AND duplicate_of_lead_id IS NULL`,
    [businessId]
  );
  const row = result.rows[0];
  const met = Number(row?.met ?? 0);
  const missed = Number(row?.missed ?? 0);
  const pending = Number(row?.pending ?? 0);
  const overdue = Number(row?.overdue ?? 0);
  const resolved = met + missed;
  return {
    avgResponseSeconds: row?.avg_response ? Math.round(Number(row.avg_response)) : null,
    slaMetCount: met,
    slaMissedCount: missed,
    slaPendingCount: pending,
    overdueCount: overdue,
    complianceRate: resolved > 0 ? Math.round((met / resolved) * 1000) / 10 : 0,
  };
}

export async function countUnworkedLeads(businessId: string): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM leads
     WHERE business_id = $1 AND status = 'New' AND first_contact_at IS NULL AND duplicate_of_lead_id IS NULL`,
    [businessId]
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function sourcePerformance(businessId: string): Promise<
  Array<{ source: string; totalLeads: number; qualified: number; won: number }>
> {
  const result = await query<{ source: string; total_leads: string; qualified: string; won: string }>(
    `SELECT source,
            COUNT(*)::text AS total_leads,
            COALESCE(SUM(CASE WHEN status IN ('Qualified','Proposal','Negotiation','Won') THEN 1 ELSE 0 END), 0)::text AS qualified,
            COALESCE(SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END), 0)::text AS won
     FROM leads
     WHERE business_id = $1 AND duplicate_of_lead_id IS NULL
     GROUP BY source
     ORDER BY total_leads DESC`,
    [businessId]
  );
  return result.rows.map((r) => ({
    source: r.source,
    totalLeads: Number(r.total_leads),
    qualified: Number(r.qualified),
    won: Number(r.won),
  }));
}

export interface UpdateLeadInput {
  assignedUserId?: string | null;
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string;
  industry?: string | null;
  interestedIn?: string | null;
  budget?: number | null;
  timeline?: string | null;
  description?: string | null;
  status?: string;
  score?: number;
  priority?: string;
}

const FIELD_TO_COLUMN: Record<string, string> = {
  assignedUserId: 'assigned_user_id',
  name: 'name',
  company: 'company',
  email: 'email',
  phone: 'phone',
  source: 'source',
  industry: 'industry',
  interestedIn: 'interested_in',
  budget: 'budget',
  timeline: 'timeline',
  description: 'description',
  status: 'status',
  score: 'score',
  priority: 'priority',
};

export async function updateLead(id: string, businessId: string, input: UpdateLeadInput): Promise<LeadRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      const column = FIELD_TO_COLUMN[key];
      if (!column) continue;
      fields.push(`${column} = $${idx++}`);
      values.push(value);
    }
  }

  if (fields.length === 0) {
    const result = await query<LeadRow>(`SELECT * FROM leads WHERE id = $1 AND business_id = $2`, [id, businessId]);
    return result.rows[0] ?? null;
  }

  values.push(id, businessId);
  const result = await query<LeadRow>(
    `UPDATE leads SET ${fields.join(', ')} WHERE id = $${idx++} AND business_id = $${idx} RETURNING *`,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteLead(id: string, businessId: string): Promise<boolean> {
  const result = await query(`DELETE FROM leads WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return (result.rowCount ?? 0) > 0;
}

export async function countLeadsByStatus(businessId: string): Promise<Array<{ status: string; count: number }>> {
  const result = await query<{ status: string; count: string }>(
    `SELECT status, COUNT(*)::text AS count FROM leads WHERE business_id = $1 GROUP BY status`,
    [businessId]
  );
  return result.rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

export async function countLeadsBySource(businessId: string): Promise<Array<{ source: string; count: number }>> {
  const result = await query<{ source: string; count: string }>(
    `SELECT source, COUNT(*)::text AS count FROM leads WHERE business_id = $1 GROUP BY source`,
    [businessId]
  );
  return result.rows.map((r) => ({ source: r.source, count: Number(r.count) }));
}

export async function leadsOverTime(businessId: string, days: number): Promise<Array<{ date: string; count: number }>> {
  const result = await query<{ date: string; count: string }>(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date, COUNT(*)::text AS count
     FROM leads
     WHERE business_id = $1 AND created_at >= now() - ($2 || ' days')::interval
     GROUP BY date_trunc('day', created_at)
     ORDER BY date_trunc('day', created_at)`,
    [businessId, days]
  );
  return result.rows.map((r) => ({ date: r.date, count: Number(r.count) }));
}

export async function pipelineValueByStatus(businessId: string): Promise<Array<{ status: string; value: number }>> {
  const result = await query<{ status: string; value: string }>(
    `SELECT status, COALESCE(SUM(budget), 0)::text AS value FROM leads WHERE business_id = $1 GROUP BY status`,
    [businessId]
  );
  return result.rows.map((r) => ({ status: r.status, value: Number(r.value) }));
}

export async function salespersonPerformance(businessId: string): Promise<
  Array<{ userId: string; name: string; totalLeads: number; won: number; lost: number; pipelineValue: number }>
> {
  const result = await query<{
    user_id: string;
    name: string;
    total_leads: string;
    won: string;
    lost: string;
    pipeline_value: string;
  }>(
    `SELECT u.id AS user_id, u.name,
            COUNT(l.id)::text AS total_leads,
            COALESCE(SUM(CASE WHEN l.status = 'Won' THEN 1 ELSE 0 END), 0)::text AS won,
            COALESCE(SUM(CASE WHEN l.status = 'Lost' THEN 1 ELSE 0 END), 0)::text AS lost,
            COALESCE(SUM(CASE WHEN l.status NOT IN ('Won','Lost') THEN l.budget ELSE 0 END), 0)::text AS pipeline_value
     FROM users u
     LEFT JOIN leads l ON l.assigned_user_id = u.id AND l.business_id = u.business_id
     WHERE u.business_id = $1
     GROUP BY u.id, u.name
     ORDER BY u.name`,
    [businessId]
  );
  return result.rows.map((r) => ({
    userId: r.user_id,
    name: r.name,
    totalLeads: Number(r.total_leads),
    won: Number(r.won),
    lost: Number(r.lost),
    pipelineValue: Number(r.pipeline_value),
  }));
}
