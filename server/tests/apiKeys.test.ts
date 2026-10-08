import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, createSalesUser } from './helpers';

describe('API keys', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('creates an API key, showing the full secret only once', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).post('/api/api-keys').set('Authorization', `Bearer ${owner.token}`).send({ name: 'n8n integration' });

    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^lf_/);
    expect(res.body.apiKey).not.toHaveProperty('key_hash');
  });

  it('never returns key_hash when listing keys', async () => {
    const owner = await signupOwner(app);
    await request(app).post('/api/api-keys').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Key 1' });

    const list = await request(app).get('/api/api-keys').set('Authorization', `Bearer ${owner.token}`);
    expect(JSON.stringify(list.body)).not.toMatch(/key_hash/);
  });

  it('revokes an API key', async () => {
    const owner = await signupOwner(app);
    const created = await request(app).post('/api/api-keys').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Revoke Me' });

    const revokeRes = await request(app).delete(`/api/api-keys/${created.body.apiKey.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(revokeRes.status).toBe(204);

    const list = await request(app).get('/api/api-keys').set('Authorization', `Bearer ${owner.token}`);
    const revoked = list.body.apiKeys.find((k: { id: string }) => k.id === created.body.apiKey.id);
    expect(revoked.revoked_at).toBeTruthy();
  });

  it('blocks sales users from managing API keys', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);
    const res = await request(app).post('/api/api-keys').set('Authorization', `Bearer ${sales.token}`).send({ name: 'Should fail' });
    expect(res.status).toBe(403);
  });

  it('cleanly rejects /api/outreach/tick with no Authorization header at all, instead of crashing the process', async () => {
    // requireAuthOrApiKey is async and throws synchronously before any
    // await; without an asyncHandler wrapper that becomes an unhandled
    // promise rejection instead of a 401 — this is the exact request shape
    // (header completely absent, not just invalid) that every other tick
    // test in this suite always supplies something for, so it was never
    // actually exercised until the Vercel deployment adapter surfaced it.
    const res = await request(app).post('/api/outreach/tick');
    expect(res.status).toBe(401);
  });

  it('cleanly rejects /api/outreach/tick with a malformed API key', async () => {
    const res = await request(app).post('/api/outreach/tick').set('Authorization', 'Bearer lf_not_a_real_key');
    expect(res.status).toBe(401);
  });
});
