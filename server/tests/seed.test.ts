import { describe, it, expect, beforeAll } from 'vitest';
import { setupTestDatabase } from './testDb';
import { query } from '../src/db/pool';
import { seed } from '../src/db/seed';

describe('Seed script', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  it('runs end-to-end against a fresh database without error and produces demo data', async () => {
    await expect(seed()).resolves.not.toThrow();

    const business = await query<{ id: string; slug: string }>(`SELECT id, slug FROM businesses WHERE name = 'Nova Growth Agency'`);
    expect(business.rows).toHaveLength(1);
    expect(business.rows[0].slug).toBeTruthy();

    const users = await query(`SELECT id FROM users WHERE business_id = $1`, [business.rows[0].id]);
    expect(users.rows.length).toBe(3);

    const leads = await query(`SELECT id FROM leads WHERE business_id = $1`, [business.rows[0].id]);
    expect(leads.rows.length).toBeGreaterThanOrEqual(15);

    const forms = await query(`SELECT id FROM lead_forms WHERE business_id = $1`, [business.rows[0].id]);
    expect(forms.rows.length).toBeGreaterThanOrEqual(1);

    const campaigns = await query(`SELECT id FROM campaigns WHERE business_id = $1`, [business.rows[0].id]);
    expect(campaigns.rows.length).toBeGreaterThanOrEqual(1);

    const rules = await query(`SELECT id FROM lead_routing_rules WHERE business_id = $1`, [business.rows[0].id]);
    expect(rules.rows.length).toBeGreaterThanOrEqual(1);
  });

  it('is safe to re-run (reseeding clears and recreates the demo business)', async () => {
    await expect(seed()).resolves.not.toThrow();
    const businesses = await query(`SELECT id FROM businesses WHERE name = 'Nova Growth Agency'`);
    expect(businesses.rows).toHaveLength(1);
  });
});
