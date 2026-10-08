import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../utils/appError';
import { verifyToken } from '../utils/jwt';
import * as apiKeyRepo from '../repositories/apiKeyRepo';
import { secretMatches } from '../utils/secrets';
import { asyncHandler } from '../utils/asyncHandler';

/**
 * Accepts EITHER a normal owner/sales JWT OR a business API key (the same
 * keys issued under Settings -> API Keys). This is what lets any external
 * scheduler (currently a GitHub Actions scheduled workflow) call the
 * outreach tick endpoint on a schedule using a long-lived API key, while
 * the LeadFlow UI keeps using normal JWT auth for the same endpoint. The
 * scheduler never gets write access beyond what the API key's business
 * scope allows, and LeadFlow remains the sole source of truth: the
 * scheduler only ever triggers processing, it never holds outreach state.
 *
 * Wrapped in asyncHandler like every other async route handler in this
 * codebase — without it, a thrown UnauthorizedError here becomes an
 * unhandled promise rejection (this function is async) instead of a clean
 * 401, since Express 4 does not await middleware return values on its own.
 */
export const requireAuthOrApiKey = asyncHandler(async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token or API key is required');
  }
  const token = header.slice('Bearer '.length).trim();

  if (token.startsWith('lf_')) {
    const parts = token.split('_');
    const prefix = parts[1];
    if (!prefix) throw new UnauthorizedError('Invalid API key');

    const apiKey = await apiKeyRepo.findActiveApiKeyByPrefix(prefix);
    if (!apiKey || !secretMatches(token, apiKey.key_hash)) {
      throw new UnauthorizedError('Invalid or revoked API key');
    }

    await apiKeyRepo.touchApiKey(apiKey.id);
    req.user = { userId: apiKey.created_by ?? '', businessId: apiKey.business_id, role: 'owner' };
    req.authMethod = 'api_key';
    next();
    return;
  }

  try {
    req.user = verifyToken(token);
    req.authMethod = 'jwt';
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
});
