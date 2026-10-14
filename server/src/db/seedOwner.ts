/**
 * Idempotently ensures the real business's first owner account exists, if
 * and only if OWNER_EMAIL, OWNER_PASSWORD, and OWNER_BUSINESS_NAME are all
 * set. Safe to run on every server boot: does nothing if any are unset,
 * and does nothing if a user with that email already exists (so restarts
 * never touch it again — e.g. if the password has since been changed
 * through normal means).
 *
 * This exists because LeadFlow has no public signup endpoint (see
 * docs/MIGRATION_TO_CLIENT.md) — without this, the only way to create the
 * first account on a fresh production database would be the demo seed
 * script (server/src/db/seed.ts, deliberately gated against production —
 * see that file) or a hand-written SQL insert with a fabricated password
 * hash, which this avoids entirely by reusing the exact same hashPassword
 * utility every other account goes through.
 */
import { env } from '../config/env';
import { hashPassword } from '../utils/password';
import { findUserByEmail, createUser } from '../repositories/userRepo';
import { createBusiness } from '../repositories/businessRepo';

export interface OwnerBootstrapConfig {
  email: string;
  password: string;
  name: string;
  businessName: string;
}

function configFromEnv(): OwnerBootstrapConfig {
  return { email: env.OWNER_EMAIL, password: env.OWNER_PASSWORD, name: env.OWNER_NAME, businessName: env.OWNER_BUSINESS_NAME };
}

export async function ensureOwnerAccount(config: OwnerBootstrapConfig = configFromEnv()): Promise<void> {
  if (!config.email || !config.password || !config.businessName) {
    return;
  }

  const existing = await findUserByEmail(config.email);
  if (existing) {
    return;
  }

  const business = await createBusiness({ name: config.businessName });
  const passwordHash = await hashPassword(config.password);
  await createUser({
    businessId: business.id,
    name: config.name,
    email: config.email,
    passwordHash,
    role: 'owner',
  });

  console.log(`Owner account provisioned for ${config.email} (business "${config.businessName}")`);
}
