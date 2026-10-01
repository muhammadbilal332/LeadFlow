import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Security', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('does not break or leak data when a SQL injection payload is used as a search filter', async () => {
    const owner = await signupOwner(app);
    await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Safe Lead', source: 'Website' });

    const payload = "'; DROP TABLE leads; --";
    const res = await request(app)
      .get(`/api/leads?search=${encodeURIComponent(payload)}`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.leads)).toBe(true);

    const followUp = await request(app).get('/api/leads').set('Authorization', `Bearer ${owner.token}`);
    expect(followUp.status).toBe(200);
    expect(followUp.body.leads.some((l: { name: string }) => l.name === 'Safe Lead')).toBe(true);
  });

  it('does not allow a SQL injection payload in a CSV import row to corrupt data', async () => {
    const owner = await signupOwner(app);
    const csv = 'name,source\n"Robert\'); DROP TABLE leads; --",Website';

    const importRes = await request(app).post('/api/leads/import').set('Authorization', `Bearer ${owner.token}`).send({ csv });
    expect(importRes.status).toBe(200);
    expect(importRes.body.imported).toBe(1);

    const listRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${owner.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.leads.length).toBeGreaterThan(0);
  });

  it('never returns a password_hash field from any auth or user endpoint', async () => {
    const owner = await signupOwner(app);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${owner.token}`);
    const users = await request(app).get('/api/users').set('Authorization', `Bearer ${owner.token}`);

    expect(JSON.stringify(me.body)).not.toMatch(/password_hash|passwordHash/);
    expect(JSON.stringify(users.body)).not.toMatch(/password_hash|passwordHash/);
  });
});
