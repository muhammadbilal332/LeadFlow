import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { runTick } from '../services/outreach/outreachQueueService';
import * as automationExecutionLogRepo from '../repositories/automationExecutionLogRepo';

/**
 * The single endpoint that advances the outreach pipeline: generates any
 * newly-due drafts, then sends every human-approved, ready draft. Designed
 * to be called on a schedule by an external scheduler (via an API key —
 * currently a GitHub Actions scheduled workflow) or manually from the
 * UI/tests for the local demo flow — LeadFlow does all the work and stays
 * the sole source of truth; the caller is just a trigger.
 *
 * Every call is recorded to automation_execution_logs regardless of
 * outcome — this is the real, honest signal the developer dashboard's
 * automation monitor reads to report "connected," rather than assuming a
 * connection just because this route exists.
 */
export const tick = asyncHandler(async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const result = await runTick(req.user!.businessId);
    await automationExecutionLogRepo.recordExecution({
      businessId: req.user!.businessId,
      triggeredBy: req.authMethod ?? 'jwt',
      status: 'success',
      draftsGenerated: result.draftsGenerated,
      sent: result.sent,
      blocked: result.blocked,
      failed: result.failed,
      durationMs: Date.now() - startedAt,
    });
    res.json({ result });
  } catch (err) {
    await automationExecutionLogRepo.recordExecution({
      businessId: req.user?.businessId ?? null,
      triggeredBy: req.authMethod ?? 'jwt',
      status: 'failure',
      error: err instanceof Error ? err.message : 'Unknown error',
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
});
