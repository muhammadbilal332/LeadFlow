import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ForbiddenError, NotFoundError } from '../utils/appError';
import * as leadRepo from '../repositories/leadRepo';
import * as performanceRepo from '../repositories/performanceRepo';
import { countDueFollowUps } from '../repositories/followUpRepo';
import { canReadLeadReplies } from '../utils/replyAccess';

const PERIOD_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };

/**
 * Start of the selected period. The client sends the real calendar start in
 * its own timezone (?since=ISO), so "Today" means today for the viewer. If it
 * is missing or invalid, fall back to a rolling window for ?period=.
 */
function periodSince(req: Request): string {
  const sinceParam = typeof req.query.since === 'string' ? new Date(req.query.since) : null;
  if (sinceParam && !Number.isNaN(sinceParam.getTime())) return sinceParam.toISOString();
  const days = PERIOD_DAYS[String(req.query.period)] ?? PERIOD_DAYS.week;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.user!.businessId;
  const restrictToUserId = req.user!.role === 'sales' ? req.user!.userId : undefined;
  const since = periodSince(req);

  const [byStatus, bySource, overTime, dueFollowUps, unworkedLeads, sla, performance, activity] = await Promise.all([
    leadRepo.countLeadsByStatus(businessId),
    leadRepo.countLeadsBySource(businessId),
    leadRepo.leadsOverTime(businessId, 30),
    countDueFollowUps(businessId),
    leadRepo.countUnworkedLeads(businessId),
    leadRepo.slaMetrics(businessId),
    leadRepo.listTeamMembers(businessId),
    performanceRepo.activityByUser(businessId, since),
  ]);

  const activityByUser = new Map(activity.map((a) => [a.userId, a]));

  // Every per-person number here is limited to the selected period. Owners
  // only appear when they had activity in it, so the list stays focused on the
  // people doing the selling.
  const salespeople = performance
    .map((p) => {
      const act = activityByUser.get(p.userId);
      const emailsSent = act?.emailsSent ?? 0;
      const repliesReceived = act?.repliesReceived ?? 0;
      const newLeads = act?.newLeads ?? 0;
      const won = act?.won ?? 0;
      const lost = act?.lost ?? 0;
      const closed = won + lost;
      return {
        userId: p.userId,
        name: p.name,
        role: p.role,
        emailsSent,
        repliesReceived,
        newLeads,
        won,
        lost,
        conversionRate: closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0,
        hasActivity: emailsSent + repliesReceived + newLeads + won + lost > 0,
      };
    })
    .filter((p) => (restrictToUserId ? p.userId === restrictToUserId : p.role !== 'owner' || p.hasActivity))
    .map(({ hasActivity: _hasActivity, ...rest }) => rest);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s.count]));
  const totalLeads = byStatus.reduce((sum, s) => sum + s.count, 0);
  const won = statusMap.Won ?? 0;
  const lost = statusMap.Lost ?? 0;
  const closed = won + lost;
  const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;

  res.json({
    kpis: {
      totalLeads,
      newLeads: statusMap.New ?? 0,
      qualifiedLeads: statusMap.Qualified ?? 0,
      wonDeals: won,
      lostDeals: lost,
      conversionRate,
      followUpsDue: dueFollowUps,
      unworkedLeads,
      slaComplianceRate: sla.complianceRate,
      overdueLeads: sla.overdueCount,
    },
    salespeople,
    charts: {
      leadsByStatus: byStatus,
      leadsBySource: bySource,
      leadsOverTime: overTime,
    },
  });
});

/** Sales users may only look at their own emails; owners and managers see everyone. */
function assertCanViewPerson(req: Request, userId: string): void {
  if (req.user!.role === 'sales' && req.user!.userId !== userId) {
    throw new ForbiddenError('You can only view your own emails');
  }
}

export const getPersonEmails = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.user!.businessId;
  const userId = req.params.userId;
  assertCanViewPerson(req, userId);

  const person = await performanceRepo.findPerson(businessId, userId);
  if (!person) throw new NotFoundError('Salesperson not found');

  const [emails, repliesByThread] = await Promise.all([
    performanceRepo.listEmailsSentBy(businessId, userId, periodSince(req)),
    performanceRepo.replyCountsByThread(businessId),
  ]);

  res.json({
    person,
    emails: emails.map((e) => ({ ...e, reply_count: e.thread_id ? repliesByThread.get(e.thread_id) ?? 0 : 0 })),
  });
});

export const getPersonEmail = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.user!.businessId;
  const userId = req.params.userId;
  assertCanViewPerson(req, userId);

  const email = await performanceRepo.findEmailSentBy(businessId, userId, req.params.messageId);
  if (!email) throw new NotFoundError('Email not found');

  // Replies follow the same rule as everywhere else: the lead's assignee and the owner only.
  const lead = email.lead_id ? await leadRepo.findLeadById(email.lead_id, businessId) : null;
  const replies = canReadLeadReplies(req.user!, lead?.assigned_user_id)
    ? await performanceRepo.listRepliesForThread(businessId, email.thread_id)
    : [];
  res.json({ email, replies });
});
