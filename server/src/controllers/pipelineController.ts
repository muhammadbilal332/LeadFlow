import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { LEAD_STATUSES } from '../validation/schemas';
import { listLeads } from '../repositories/leadRepo';

export const getPipeline = asyncHandler(async (req: Request, res: Response) => {
  const restrictToUserId = req.user!.role === 'sales' ? req.user!.userId : undefined;

  const columns = await Promise.all(
    LEAD_STATUSES.map(async (status) => {
      const { rows } = await listLeads(req.user!.businessId, {
        page: 1,
        pageSize: 500,
        status,
        sortBy: 'created_at',
        sortDir: 'desc',
        restrictToUserId,
      });
      return { status, leads: rows };
    })
  );

  res.json({ columns });
});
