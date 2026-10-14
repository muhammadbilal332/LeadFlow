import { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { findBusinessById } from '../repositories/businessRepo';
import { BadRequestError, NotFoundError } from '../utils/appError';

/**
 * For routes reachable only by the platform-wide `developer` role (whose
 * own JWT carries the id of a dedicated scaffolding business, never a real
 * one — see docs/DEVELOPER_DASHBOARD.md). Those routes' controllers all
 * read `req.user.businessId` to scope their queries, exactly like every
 * other business-scoped controller; this middleware is what lets a
 * developer explicitly say which real business they're acting on, via a
 * `businessId` query parameter, by overwriting `req.user.businessId` with
 * it for the rest of the request — never guessed, since a guess ("the one
 * business that isn't the platform scaffold") breaks down the moment more
 * than one non-platform business exists, which the test suite's own
 * fixtures routinely create.
 */
async function resolveAndOverrideBusiness(req: Request): Promise<void> {
  const businessId = req.query.businessId;
  if (typeof businessId !== 'string' || businessId.length === 0) {
    throw new BadRequestError('A businessId query parameter is required');
  }
  const business = await findBusinessById(businessId);
  if (!business) {
    throw new NotFoundError('Business not found');
  }
  req.user!.businessId = business.id;
}

export const requireTargetBusiness = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  await resolveAndOverrideBusiness(req);
  next();
});

/**
 * For routes still reachable by `owner`/`manager` on their own business
 * (unchanged, no query param needed) that a developer-console page also
 * calls against a real business of its choosing. A no-op for any
 * non-developer caller — existing owner/manager behavior on these shared
 * routes is untouched.
 */
export const resolveTargetBusinessForDeveloper = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (req.user!.role !== 'developer') {
    next();
    return;
  }
  await resolveAndOverrideBusiness(req);
  next();
});
