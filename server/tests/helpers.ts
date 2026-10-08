import request from 'supertest';
import { Express } from 'express';
import { hashPassword } from '../src/utils/password';
import { signToken } from '../src/utils/jwt';
import { createBusiness } from '../src/repositories/businessRepo';
import { createUser } from '../src/repositories/userRepo';

export interface TestAccount {
  token: string;
  userId: string;
  businessId: string;
  email: string;
}

let counter = 0;

/**
 * Creates an isolated owner+business pair directly through the repositories
 * (mirroring signupDeveloper's existing pattern) rather than through a
 * public HTTP endpoint — LeadFlow no longer exposes public self-service
 * business creation (standalone single-business app), but the test suite
 * still needs its own isolated business per test to exercise cross-business
 * scoping and permission checks.
 */
export async function signupOwner(app: Express, overrides: Partial<{ businessName: string; name: string; email: string; password: string }> = {}): Promise<TestAccount> {
  counter++;
  const email = overrides.email ?? `owner${counter}@test.com`;
  const password = overrides.password ?? 'password123';

  const business = await createBusiness({ name: overrides.businessName ?? `Test Business ${counter}` });
  const passwordHash = await hashPassword(password);
  const user = await createUser({
    businessId: business.id,
    name: overrides.name ?? 'Test Owner',
    email,
    passwordHash,
    role: 'owner',
  });

  const token = signToken({ userId: user.id, businessId: business.id, role: user.role });

  return { token, userId: user.id, businessId: business.id, email };
}

/**
 * There is no public signup path for a developer account — by design, the
 * same way real deployments provision one: directly, e.g. via the
 * DEVELOPER_EMAIL/DEVELOPER_PASSWORD startup seed (see seedDeveloper.ts).
 * This mirrors that exact mechanism for tests, then logs in through the
 * real /api/auth/login endpoint like any other account.
 */
export async function signupDeveloper(app: Express, overrides: Partial<{ email: string; password: string }> = {}): Promise<TestAccount> {
  counter++;
  const email = overrides.email ?? `developer${counter}@test.com`;
  const password = overrides.password ?? 'password123';

  const business = await createBusiness({ name: 'LeadFlow Platform (test)' });
  const passwordHash = await hashPassword(password);
  const user = await createUser({ businessId: business.id, name: 'Developer', email, passwordHash, role: 'developer' });

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  if (loginRes.status !== 200) {
    throw new Error(`Developer login failed: ${JSON.stringify(loginRes.body)}`);
  }

  return { token: loginRes.body.token, userId: user.id, businessId: business.id, email };
}

export async function createSalesUser(app: Express, ownerToken: string, overrides: Partial<{ name: string; email: string; password: string }> = {}): Promise<TestAccount & { password: string }> {
  counter++;
  const email = overrides.email ?? `sales${counter}@test.com`;
  const password = overrides.password ?? 'password123';

  const createRes = await request(app)
    .post('/api/users')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ name: overrides.name ?? 'Test Sales', email, password, role: 'sales' });

  if (createRes.status !== 201) {
    throw new Error(`Create sales user failed: ${JSON.stringify(createRes.body)}`);
  }

  const loginRes = await request(app).post('/api/auth/login').send({ email, password });

  return {
    token: loginRes.body.token,
    userId: loginRes.body.user.id,
    businessId: loginRes.body.user.businessId,
    email,
    password,
  };
}
