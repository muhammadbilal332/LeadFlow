import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { simulateReplySchema } from '../validation/outreachSchemas';
import * as emailReplyRepo from '../repositories/emailReplyRepo';
import { processInboundReply } from '../services/outreach/replyProcessingService';
import { getMockInboundProvider } from '../providers/inbound';
import { env } from '../config/env';
import { BadRequestError } from '../utils/appError';

export const listReplies = asyncHandler(async (req: Request, res: Response) => {
  const replies = await emailReplyRepo.listForBusiness(req.user!.businessId);
  res.json({ replies });
});

/**
 * Dev/demo-only endpoint: simulates an inbound reply through the exact same
 * replyProcessingService code path a real provider webhook would use. Only
 * available while INBOUND_PROVIDER=mock — there is no live mailbox to
 * receive a real reply against, so this is how the mock pipeline (and the
 * end-to-end test/demo flow) exercises reply handling.
 */
export const simulateReply = asyncHandler(async (req: Request, res: Response) => {
  if (env.INBOUND_PROVIDER !== 'mock') {
    throw new BadRequestError('Reply simulation is only available when INBOUND_PROVIDER=mock');
  }

  const input = simulateReplySchema.parse(req.body);
  const event = getMockInboundProvider().buildSimulatedEvent(input);
  const result = await processInboundReply(req.user!.businessId, event);
  res.status(201).json({ result });
});
