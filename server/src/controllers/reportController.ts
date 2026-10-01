import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as leadRepo from '../repositories/leadRepo';
import * as campaignRepo from '../repositories/campaignRepo';

export const getReports = asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.user!.businessId;

  const [byStatus, bySource, pipelineValue, performance, sourcePerf, sla, campaigns] = await Promise.all([
    leadRepo.countLeadsByStatus(businessId),
    leadRepo.countLeadsBySource(businessId),
    leadRepo.pipelineValueByStatus(businessId),
    leadRepo.salespersonPerformance(businessId),
    leadRepo.sourcePerformance(businessId),
    leadRepo.slaMetrics(businessId),
    campaignRepo.campaignPerformance(businessId),
  ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s.status, s.count]));
  const totalLeads = byStatus.reduce((sum, s) => sum + s.count, 0);
  const won = statusMap.Won ?? 0;
  const lost = statusMap.Lost ?? 0;
  const closed = won + lost;
  const conversionRate = closed > 0 ? Math.round((won / closed) * 1000) / 10 : 0;

  res.json({
    totalLeads,
    conversionRate,
    won,
    lost,
    leadsByStatus: byStatus,
    leadsBySource: bySource,
    pipelineValueByStatus: pipelineValue,
    salespersonPerformance: performance,
    sourcePerformance: sourcePerf,
    sla,
    campaignPerformance: campaigns,
  });
});
