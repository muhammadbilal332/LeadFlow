import { query } from '../db/pool';

export interface CampaignRow {
  id: string;
  business_id: string;
  name: string;
  source: string | null;
  utm_campaign: string | null;
  external_campaign_id: string | null;
  created_at: string;
  updated_at: string;
}

export async function listCampaigns(businessId: string): Promise<CampaignRow[]> {
  const result = await query<CampaignRow>(
    `SELECT * FROM campaigns WHERE business_id = $1 ORDER BY created_at DESC`,
    [businessId]
  );
  return result.rows;
}

export async function findCampaignById(id: string, businessId: string): Promise<CampaignRow | null> {
  const result = await query<CampaignRow>(`SELECT * FROM campaigns WHERE id = $1 AND business_id = $2`, [id, businessId]);
  return result.rows[0] ?? null;
}

/** Finds an existing campaign by utm_campaign within the business, or creates one. Returns null if no utm_campaign given. */
export async function findOrCreateCampaign(
  businessId: string,
  utmCampaign: string | null | undefined,
  source: string | null | undefined
): Promise<CampaignRow | null> {
  if (!utmCampaign || !utmCampaign.trim()) return null;

  const existing = await query<CampaignRow>(
    `SELECT * FROM campaigns WHERE business_id = $1 AND utm_campaign = $2`,
    [businessId, utmCampaign]
  );
  if (existing.rows[0]) return existing.rows[0];

  const result = await query<CampaignRow>(
    `INSERT INTO campaigns (business_id, name, source, utm_campaign) VALUES ($1, $2, $3, $4)
     ON CONFLICT (business_id, utm_campaign) DO UPDATE SET utm_campaign = EXCLUDED.utm_campaign
     RETURNING *`,
    [businessId, utmCampaign, source ?? null, utmCampaign]
  );
  return result.rows[0];
}

export interface CampaignPerformanceRow {
  id: string;
  name: string;
  source: string | null;
  utm_campaign: string | null;
  total_leads: number;
  qualified: number;
  won: number;
  revenue: number;
}

export async function campaignPerformance(businessId: string): Promise<CampaignPerformanceRow[]> {
  const campaigns = await query<CampaignRow>(`SELECT * FROM campaigns WHERE business_id = $1 ORDER BY created_at DESC`, [businessId]);

  const leadCounts = await query<{ campaign_id: string; total_leads: string; qualified: string; won: string }>(
    `SELECT campaign_id,
            COUNT(*)::text AS total_leads,
            COALESCE(SUM(CASE WHEN status IN ('Qualified','Proposal','Negotiation','Won') THEN 1 ELSE 0 END), 0)::text AS qualified,
            COALESCE(SUM(CASE WHEN status = 'Won' THEN 1 ELSE 0 END), 0)::text AS won
     FROM leads
     WHERE business_id = $1 AND campaign_id IS NOT NULL
     GROUP BY campaign_id`,
    [businessId]
  );

  const revenueByCampaign = await query<{ campaign_id: string; revenue: string }>(
    `SELECT l.campaign_id, SUM(q.amount)::text AS revenue
     FROM leads l
     JOIN quotations q ON q.lead_id = l.id AND q.status = 'Accepted'
     WHERE l.business_id = $1 AND l.campaign_id IS NOT NULL
     GROUP BY l.campaign_id`,
    [businessId]
  );

  const countsById = new Map(leadCounts.rows.map((r) => [r.campaign_id, r]));
  const revenueById = new Map(revenueByCampaign.rows.map((r) => [r.campaign_id, Number(r.revenue)]));

  return campaigns.rows
    .map((c) => {
      const counts = countsById.get(c.id);
      return {
        id: c.id,
        name: c.name,
        source: c.source,
        utm_campaign: c.utm_campaign,
        total_leads: Number(counts?.total_leads ?? 0),
        qualified: Number(counts?.qualified ?? 0),
        won: Number(counts?.won ?? 0),
        revenue: revenueById.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => b.total_leads - a.total_leads);
}
