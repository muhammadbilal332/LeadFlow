import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../utils/appError';
import { verifyToken } from '../utils/jwt';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication token is required');
  }

  const token = header.slice('Bearer '.length).trim();

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
