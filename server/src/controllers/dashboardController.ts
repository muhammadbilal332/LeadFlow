import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as leadRepo from '../repositories/leadRepo';
import { countDueFollowUps } from '../repositories/followUpRepo';

export const getDashboard = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.user!.businessId;

  const [byStatus, bySource, overTime, pipelineValue, dueFollowUps, unworkedLeads, sla] = await Promise.all([
    leadRepo.countLeadsByStatus(businessId),
    leadRepo.countLeadsBySource(businessId),
    leadRepo.leadsOverTime(businessId, 30),
    leadRepo.pipelineValueByStatus(businessId),
    countDueFollowUps(businessId),
    leadRepo.countUnworkedLeads(businessId),
    leadRepo.slaMetrics(businessId),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s.count]));
  const totalLeads = byStatus.reduce((sum, s) => sum + s.count, 0);
  const won = statusMap.Won ?? 0;
  const lost = statusMap.Lost ?? 0;
  const closed = won + lost;
  const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;
  const openPipelineValue = pipelineValue
    .filter((p) => p.status !== 'Won' && p.status !== 'Lost')
    .reduce((sum, p) => sum + p.value, 0);

  res.json({
    kpis: {
      totalLeads,
      newLeads: statusMap.New ?? 0,
      qualifiedLeads: statusMap.Qualified ?? 0,
      wonDeals: won,
      lostDeals: lost,
      conversionRate,
      followUpsDue: dueFollowUps,
      pipelineValue: openPipelineValue,
      unworkedLeads,
      slaComplianceRate: sla.complianceRate,
      overdueLeads: sla.overdueCount,
    },
    charts: {
      leadsByStatus: byStatus,
      leadsBySource: bySource,
      leadsOverTime: overTime,
      pipelineValueByStatus: pipelineValue,
    },
  });
});
