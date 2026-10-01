import { JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      /** Raw request body bytes, captured for webhook signature verification (see app.ts). */
      rawBody?: Buffer;
      /** Set by requireAuthOrApiKey — distinguishes a real external caller (n8n, via API key) from the LeadFlow UI itself (JWT), used for honest n8n-connection reporting. */
      authMethod?: 'jwt' | 'api_key';
    }
  }
}

export {};
