import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDatabase } from './testDb';
import { ensureOwnerAccount } from '../src/db/seedOwner';
import { assertNotProduction } from '../src/db/seed';
import { findUserByEmail } from '../src/repositories/userRepo';
import { query } from '../src/db/pool';

describe('ensureOwnerAccount (production-safe owner bootstrap)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  it('does nothing when any of the three required config values is missing', async () => {
    await ensureOwnerAccount({ email: '', password: 'x', name: 'Owner', businessName: 'Real Co' });
    await ensureOwnerAccount({ email: 'a@real.com', password: '', name: 'Owner', businessName: 'Real Co' });
    await ensureOwnerAccount({ email: 'a@real.com', password: 'x', name: 'Owner', businessName: '' });

    const user = await findUserByEmail('a@real.com');
    expect(user).toBeNull();
  });

  it('creates exactly one business and one owner user when all three are set', async () => {
    await ensureOwnerAccount({ email: 'contact@realclient.test', password: 'a-real-password', name: 'The Owner', businessName: 'Real Client Co' });

    const user = await findUserByEmail('contact@realclient.test');
    expect(user).not.toBeNull();
    expect(user!.role).toBe('owner');

    const business = await query<{ name: string }>('SELECT name FROM businesses WHERE id = $1', [user!.business_id]);
    expect(business.rows[0].name).toBe('Real Client Co');

    // Never a fabricated or empty hash — a real bcrypt hash was produced.
    expect(user!.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it('is idempotent — a second call with the same email never creates a duplicate or a second business', async () => {
    const before = await query<{ count: string }>('SELECT count(*)::text FROM businesses');
    await ensureOwnerAccount({ email: 'contact@realclient.test', password: 'a-different-password', name: 'The Owner', businessName: 'Real Client Co' });
    const after = await query<{ count: string }>('SELECT count(*)::text FROM businesses');

    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  it('never overwrites an existing account at that email, even with different config', async () => {
    const original = await findUserByEmail('contact@realclient.test');
    await ensureOwnerAccount({ email: 'contact@realclient.test', password: 'yet-another-password', name: 'A Different Name', businessName: 'A Different Co' });
    const after = await findUserByEmail('contact@realclient.test');

    expect(after!.name).toBe(original!.name);
    expect(after!.password_hash).toBe(original!.password_hash);
  });
});

describe('assertNotProduction (guards server/src/db/seed.ts against a real database)', () => {
  it('allows seeding outside production', () => {
    expect(() => assertNotProduction('development', '')).not.toThrow();
    expect(() => assertNotProduction('test', '')).not.toThrow();
  });

  it('refuses to seed when NODE_ENV=production without the explicit override', () => {
    expect(() => assertNotProduction('production', '')).toThrow(/Refusing to seed/);
    expect(() => assertNotProduction('production', 'close-but-wrong')).toThrow(/Refusing to seed/);
  });

  it('allows it only with the exact override phrase', () => {
    expect(() => assertNotProduction('production', 'yes-i-am-sure')).not.toThrow();
  });
});
