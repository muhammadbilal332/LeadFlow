/**
 * Idempotently ensures a developer/admin account exists, if and only if
 * DEVELOPER_EMAIL and DEVELOPER_PASSWORD are both set. Safe to run on every
 * server boot: does nothing if the vars are unset, and does nothing if a
 * user with that email already exists (so restarts never touch it again —
 * e.g. if someone has since changed the password through normal means).
 *
 * The developer account needs a business_id like every other user; it gets
 * its own dedicated, clearly-named business rather than being attached to
 * a real customer's business.
 */
import { env } from '../config/env';
import { hashPassword } from '../utils/password';
import { findUserByEmail, createUser } from '../repositories/userRepo';
import { createBusiness } from '../repositories/businessRepo';

const PLATFORM_BUSINESS_NAME = 'LeadFlow Platform';

export async function ensureDeveloperAccount(): Promise<void> {
  if (!env.DEVELOPER_EMAIL || !env.DEVELOPER_PASSWORD) {
    return;
  }

  const existing = await findUserByEmail(env.DEVELOPER_EMAIL);
  if (existing) {
    return;
  }

  const business = await createBusiness({ name: PLATFORM_BUSINESS_NAME });
  const passwordHash = await hashPassword(env.DEVELOPER_PASSWORD);
  await createUser({
    businessId: business.id,
    name: 'Developer',
    email: env.DEVELOPER_EMAIL,
    passwordHash,
    role: 'developer',
  });

  console.log(`Developer account provisioned for ${env.DEVELOPER_EMAIL}`);
}
