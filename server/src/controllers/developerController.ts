import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as developerRepo from '../repositories/developerRepo';
import * as userRepo from '../repositories/userRepo';
import * as businessRepo from '../repositories/businessRepo';
import * as systemEventRepo from '../repositories/systemEventRepo';
import * as developerAuditLogRepo from '../repositories/developerAuditLogRepo';
import * as n8nExecutionLogRepo from '../repositories/n8nExecutionLogRepo';
import { getPool, query } from '../db/pool';
import { getEmailProvider } from '../providers/email';
import { getOutreachAIProvider } from '../providers/ai';
import { getSheetsProvider } from '../providers/sheets';
import { getInboundProvider } from '../providers/inbound';
import { env } from '../config/env';
import { changeUserRoleSchema, setUserStatusSchema, leadFilterQuerySchema, daysQuerySchema } from '../validation/developerSchemas';
import { NotFoundError, BadRequestError } from '../utils/appError';

async function audit(req: Request, action: string, targetType: string, targetId?: string | null, businessId?: string | null, metadata?: Record<string, unknown>) {
  await developerAuditLogRepo.logDeveloperAction({
    actorUserId: req.user!.userId,
    action,
    targetType,
    targetId: targetId ?? null,
    businessId: businessId ?? null,
    metadata,
    ipAddress: req.ip ?? null,
  });
}

// ===========================================================
// Overview
// ===========================================================
export const getOverview = asyncHandler(async (req: Request, res: Response) => {
  const { days } = daysQuerySchema.parse(req.query);
  const [overview, leadsOverTime, emailsOverTime, repliesOverTime] = await Promise.all([
    developerRepo.getPlatformOverview(),
    developerRepo.getLeadsOverTime(days),
    developerRepo.getEmailsOverTime(days),
    developerRepo.getRepliesOverTime(days),
  ]);

  res.json({ overview, charts: { leadsOverTime, emailsOverTime, repliesOverTime } });
});

// ===========================================================
// Businesses
// ===========================================================
export const listBusinesses = asyncHandler(async (_req: Request, res: Response) => {
  const businesses = await developerRepo.listBusinesses();
  res.json({ businesses });
});

export const getBusiness = asyncHandler(async (req: Request, res: Response) => {
  const business = await developerRepo.getBusinessDetail(req.params.id);
  if (!business) throw new NotFoundError('Business not found');
  await audit(req, 'developer_viewed_business', 'business', business.id, business.id);
  res.json({ business });
});

/** Blocks every user of this business from logging in. Fully reversible via reactivateBusiness. */
export const deactivateBusiness = asyncHandler(async (req: Request, res: Response) => {
  const business = await businessRepo.findBusinessById(req.params.id);
  if (!business) throw new NotFoundError('Business not found');
  if (!business.is_active) throw new BadRequestError('This business is already deactivated');

  const updated = await businessRepo.setBusinessActive(business.id, false);
  await audit(req, 'developer_deactivated_business', 'business', business.id, business.id, { name: business.name });
  res.json({ business: updated });
});

export const reactivateBusiness = asyncHandler(async (req: Request, res: Response) => {
  const business = await businessRepo.findBusinessById(req.params.id);
  if (!business) throw new NotFoundError('Business not found');
  if (business.is_active) throw new BadRequestError('This business is already active');

  const updated = await businessRepo.setBusinessActive(business.id, true);
  await audit(req, 'developer_reactivated_business', 'business', business.id, business.id, { name: business.name });
  res.json({ business: updated });
});

/**
 * Permanently removes a business and everything under it (cascades to
 * users, leads, outreach data via existing FK constraints) — irreversible.
 * Requires the business to already be deactivated first: a deliberate
 * two-step process so a single click can never permanently delete a live,
 * currently-active business.
 */
export const deleteBusinessHandler = asyncHandler(async (req: Request, res: Response) => {
  const business = await businessRepo.findBusinessById(req.params.id);
  if (!business) throw new NotFoundError('Business not found');
  if (business.is_active) throw new BadRequestError('Deactivate this business before deleting it');

  await businessRepo.deleteBusiness(business.id);
  await audit(req, 'developer_deleted_business', 'business', business.id, null, { name: business.name });
  res.status(204).send();
});

// ===========================================================
// Users
// ===========================================================
export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await developerRepo.listAllUsers();
  res.json({ users });
});

export const changeUserRole = asyncHandler(async (req: Request, res: Response) => {
  const input = changeUserRoleSchema.parse(req.body);
  const target = await userRepo.findUserById(req.params.id);
  if (!target) throw new NotFoundError('User not found');
  if (target.role === 'developer') throw new BadRequestError("A developer account's role cannot be changed here");

  const updated = await userRepo.updateUserRole(target.id, input.role);
  await audit(req, 'developer_changed_user_role', 'user', target.id, target.business_id, { from: target.role, to: input.role });
  res.json({ user: updated });
});

export const setUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const input = setUserStatusSchema.parse(req.body);
  const target = await userRepo.findUserById(req.params.id);
  if (!target) throw new NotFoundError('User not found');
  if (target.role === 'developer') throw new BadRequestError("A developer account's status cannot be changed here");

  const updated = await userRepo.updateUser(target.id, target.business_id, { isActive: input.isActive });
  await audit(req, input.isActive ? 'developer_enabled_user' : 'developer_disabled_user', 'user', target.id, target.business_id);
  res.json({ user: updated });
});

// ===========================================================
// Leads (cross-tenant, read-only)
// ===========================================================
/**
 * Cross-tenant lead visibility is a real privacy tradeoff (platform staff
 * seeing every business's CRM contacts), so unlike the other read-only
 * developer endpoints, every single view is audited — not just mutations —
 * including which business/filter was viewed and how many rows came back.
 */
export const listLeads = asyncHandler(async (req: Request, res: Response) => {
  const input = leadFilterQuerySchema.parse(req.query);
  const { rows, total } = await developerRepo.listAllLeads(input);
  await audit(req, 'developer_viewed_leads', 'lead_list', null, input.businessId ?? null, {
    search: input.search ?? null,
    status: input.status ?? null,
    businessId: input.businessId ?? 'all',
    page: input.page,
    resultCount: rows.length,
    total,
  });
  res.json({ leads: rows, total, page: input.page, pageSize: input.pageSize });
});

// ===========================================================
// Outreach monitoring
// ===========================================================
export const getOutreach = asyncHandler(async (_req: Request, res: Response) => {
  const [lifecycle, campaigns] = await Promise.all([developerRepo.getOutreachLifecycleStats(), developerRepo.listRecentCampaigns()]);
  res.json({ lifecycle, campaigns });
});

// ===========================================================
// n8n monitoring
// ===========================================================
export const getN8n = asyncHandler(async (_req: Request, res: Response) => {
  const [summary, recent] = await Promise.all([n8nExecutionLogRepo.getSummary(), n8nExecutionLogRepo.listRecent(25)]);

  // Honest connection status: only "CONNECTED" if n8n itself (an API-key
  // call, not the UI's manual JWT-authenticated button) has actually
  // executed the tick endpoint recently. Never inferred just because the
  // route exists.
  const connected = summary.apiKeyExecutionsLast24h > 0;

  res.json({ connected, summary, recent });
});

// ===========================================================
// Health
// ===========================================================
type HealthStatus = 'healthy' | 'degraded' | 'unavailable' | 'not_configured';

export const getHealth = asyncHandler(async (_req: Request, res: Response) => {
  let databaseStatus: HealthStatus = 'unavailable';
  try {
    await getPool().query('SELECT 1');
    databaseStatus = 'healthy';
  } catch {
    databaseStatus = 'unavailable';
  }

  const emailProvider = getEmailProvider();
  const aiProvider = getOutreachAIProvider();
  const sheetsProvider = getSheetsProvider();
  const inboundProvider = getInboundProvider();

  const n8nSummary = await n8nExecutionLogRepo.getSummary();
  const n8nStatus: HealthStatus = n8nSummary.apiKeyExecutionsLast24h > 0 ? 'healthy' : n8nSummary.totalExecutions > 0 ? 'degraded' : 'not_configured';

  const providerStatus = (configured: boolean): HealthStatus => (configured ? 'healthy' : 'not_configured');

  res.json({
    services: {
      leadflowApi: { status: 'healthy' as HealthStatus },
      database: { status: databaseStatus },
      n8n: { status: n8nStatus, detail: n8nSummary.apiKeyExecutionsLast24h > 0 ? 'Connected (recent execution)' : n8nSummary.totalExecutions > 0 ? 'No recent execution in 24h' : 'No execution recorded yet' },
      emailProvider: { status: providerStatus(emailProvider.isConfigured()), detail: emailProvider.name },
      aiProvider: { status: providerStatus(aiProvider.isConfigured()), detail: aiProvider.name },
      sheetsProvider: { status: providerStatus(sheetsProvider.isConfigured()), detail: sheetsProvider.name },
      inboundProvider: { status: providerStatus(inboundProvider.isConfigured()), detail: inboundProvider.name },
    },
  });
});

// ===========================================================
// Providers (config visibility, never secrets)
// ===========================================================
export const getProviders = asyncHandler(async (_req: Request, res: Response) => {
  const emailProvider = getEmailProvider();
  const aiProvider = getOutreachAIProvider();
  const sheetsProvider = getSheetsProvider();
  const inboundProvider = getInboundProvider();

  res.json({
    providers: {
      email: { selected: env.EMAIL_PROVIDER, name: emailProvider.name, configured: emailProvider.isConfigured() },
      ai: { selected: env.OUTREACH_AI_PROVIDER, name: aiProvider.name, configured: aiProvider.isConfigured() },
      sheets: { selected: env.SHEETS_PROVIDER, name: sheetsProvider.name, configured: sheetsProvider.isConfigured() },
      inbound: { selected: env.INBOUND_PROVIDER, name: inboundProvider.name, configured: inboundProvider.isConfigured() },
    },
  });
});

// ===========================================================
// Usage
// ===========================================================
export const getUsage = asyncHandler(async (_req: Request, res: Response) => {
  const emailProvider = getEmailProvider();
  // Platform-wide usage: sum across all businesses for the active provider.
  const day = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const [dailyTotal, monthlyTotal, aiLogCount] = await Promise.all([
    query<{ sent: string; failed: string; bounced: string }>(
      `SELECT COALESCE(SUM(sent_count),0)::text as sent, COALESCE(SUM(failed_count),0)::text as failed, COALESCE(SUM(bounced_count),0)::text as bounced
       FROM provider_usage WHERE period = 'daily' AND period_key = $1`,
      [day]
    ),
    query<{ sent: string; failed: string; bounced: string }>(
      `SELECT COALESCE(SUM(sent_count),0)::text as sent, COALESCE(SUM(failed_count),0)::text as failed, COALESCE(SUM(bounced_count),0)::text as bounced
       FROM provider_usage WHERE period = 'monthly' AND period_key = $1`,
      [month]
    ),
    query<{ count: string }>(`SELECT COUNT(*)::text as count FROM ai_generation_logs`),
  ]);

  res.json({
    provider: emailProvider.name,
    daily: { sent: Number(dailyTotal.rows[0]?.sent ?? 0), failed: Number(dailyTotal.rows[0]?.failed ?? 0), bounced: Number(dailyTotal.rows[0]?.bounced ?? 0) },
    monthly: { sent: Number(monthlyTotal.rows[0]?.sent ?? 0), failed: Number(monthlyTotal.rows[0]?.failed ?? 0), bounced: Number(monthlyTotal.rows[0]?.bounced ?? 0) },
    aiGenerationsTotal: Number(aiLogCount.rows[0]?.count ?? 0),
    n8nExecutionsTotal: (await n8nExecutionLogRepo.getSummary()).totalExecutions,
    dailyLimitPerBusiness: env.OUTREACH_DAILY_SEND_LIMIT,
    plannedMonthlyLimit: 25000,
  });
});

// ===========================================================
// Logs
// ===========================================================
export const getLogs = asyncHandler(async (req: Request, res: Response) => {
  const severity = typeof req.query.severity === 'string' && ['info', 'warning', 'error'].includes(req.query.severity) ? (req.query.severity as 'info' | 'warning' | 'error') : undefined;
  const events = await systemEventRepo.listSystemEvents({ severity, limit: 200 });
  res.json({ events });
});

// ===========================================================
// Audit
// ===========================================================
export const getAuditLogs = asyncHandler(async (_req: Request, res: Response) => {
  const logs = await developerAuditLogRepo.listAuditLogs(200);
  res.json({ logs });
});
