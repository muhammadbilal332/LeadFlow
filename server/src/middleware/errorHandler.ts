import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/appError';
import { env } from '../config/env';
import { logSystemEvent } from '../repositories/systemEventRepo';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'Validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr && pgErr.code === '23505') {
    res.status(409).json({ error: 'A record with these details already exists' });
    return;
  }
  if (pgErr && pgErr.code === '23503') {
    res.status(400).json({ error: 'Referenced record does not exist' });
    return;
  }

  console.error('Unhandled error:', err);

  // Fire-and-forget: a logging failure must never mask or delay the actual
  // error response.
  logSystemEvent({
    severity: 'error',
    eventType: 'api_error',
    businessId: req.user?.businessId ?? null,
    userId: req.user?.userId ?? null,
    message: err instanceof Error ? err.message : 'Unhandled error',
    metadata: { method: req.method, path: req.originalUrl },
  }).catch(() => {});

  res.status(500).json({
    error: 'Internal server error',
    ...(env.NODE_ENV !== 'production' && err instanceof Error ? { detail: err.message } : {}),
  });
}
