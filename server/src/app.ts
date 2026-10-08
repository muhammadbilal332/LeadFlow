import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import routes from './routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      // In development, Vite may silently move to a different port than
      // CLIENT_URL if its default port is taken (a common local conflict).
      // Allow any localhost/127.0.0.1 origin there; production still
      // strictly enforces CLIENT_URL.
      origin:
        env.NODE_ENV === 'production'
          ? env.CLIENT_URL
          : (origin, callback) => {
              if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
                callback(null, true);
              } else {
                callback(null, env.CLIENT_URL === origin);
              }
            },
      credentials: true,
    })
  );
  app.use(
    express.json({
      limit: '2mb',
      // Meta's webhook signature (X-Hub-Signature-256) is computed over the
      // exact raw request bytes, so we stash them alongside the parsed body.
      verify: (req: express.Request, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(apiLimiter);

  app.use('/api', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

// Default export alongside the named one: server.ts, every test file, and
// api/index.ts all call createApp() directly for a fresh instance, but some
// hosting platforms' zero-config framework detection (observed: Vercel's
// auto-detected "Express" preset) picks this file itself as the function
// entry point and requires a default export that's callable as (req, res).
// An Express app satisfies that directly, so this is purely additive — no
// existing importer is affected since they all use the named export.
export default createApp();
