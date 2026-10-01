import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Also allow a server-local .env (useful when running server/ standalone)
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(10, 'JWT_SECRET must be at least 10 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'none']).default('none'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().optional().default('gpt-4o-mini'),
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().optional().default('claude-3-5-haiku-latest'),
  // Public origin of the deployed app, used to build shareable links (public
  // form URLs, embed snippets, webhook URLs). Falls back to CLIENT_URL.
  PUBLIC_APP_URL: z.string().optional().default(''),
  META_APP_ID: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  META_VERIFY_TOKEN: z.string().optional().default(''),
  WEBHOOK_ENCRYPTION_KEY: z.string().optional().default(''),

  // ===========================================================
  // Outbound email automation ("Outreach") — provider switches.
  // Each defaults to 'mock', which runs the full pipeline with realistic
  // simulated behavior and zero external calls or cost. Switching to the
  // real provider is purely an env change — no code changes.
  //
  // Note: this is deliberately named OUTREACH_AI_PROVIDER, not AI_PROVIDER —
  // AI_PROVIDER already selects the provider for the existing lead
  // qualification feature above, and reusing it here would silently change
  // that feature's behavior too.
  // ===========================================================
  EMAIL_PROVIDER: z.enum(['mock', 'resend', 'brevo']).default('mock'),
  EMAIL_PLAN: z.string().optional().default('free'),
  OUTREACH_AI_PROVIDER: z.enum(['mock', 'openai']).default('mock'),
  SHEETS_PROVIDER: z.enum(['mock', 'google']).default('mock'),
  INBOUND_PROVIDER: z.enum(['mock', 'resend']).default('mock'),
  RESEND_API_KEY: z.string().optional().default(''),
  RESEND_WEBHOOK_SECRET: z.string().optional().default(''),
  // Brevo (https://brevo.com) — a free-tier alternative to Resend. Its key
  // advantage for a sender without a custom domain: Brevo can verify a
  // single sender *address* via a confirmation-link click, not just a full
  // domain via DNS records, so it can work from a personal inbox that
  // Resend would always reject.
  BREVO_API_KEY: z.string().optional().default(''),
  BREVO_WEBHOOK_SECRET: z.string().optional().default(''),
  GOOGLE_API_KEY: z.string().optional().default(''),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z.string().optional().default(''),
  N8N_WEBHOOK_URL: z.string().optional().default(''),
  OUTREACH_DAILY_SEND_LIMIT: z.coerce.number().default(100),

  // ===========================================================
  // Developer/Admin Dashboard — a platform-level account, seeded once at
  // startup if both vars are set and no user with this email exists yet.
  // Never hardcode a real password; leave both blank to disable the
  // dashboard entirely (routes still exist but nobody can log in to them).
  // ===========================================================
  DEVELOPER_EMAIL: z.string().optional().default(''),
  DEVELOPER_PASSWORD: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;

/** Public origin used to build shareable links; falls back to CLIENT_URL when unset. */
export const publicAppUrl = (env.PUBLIC_APP_URL || env.CLIENT_URL).replace(/\/+$/, '');
