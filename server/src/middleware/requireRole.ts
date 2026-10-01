import { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../utils/appError';

export function requireRole(...roles: Array<'owner' | 'sales' | 'developer'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }
    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    next();
  };
}
