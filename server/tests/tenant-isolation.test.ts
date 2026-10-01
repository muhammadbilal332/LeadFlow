import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Multi-tenant isolation', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('prevents business A from reading business B leads', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ name: 'B Lead', source: 'Website' });
    expect(createRes.status).toBe(201);
    const bLeadId = createRes.body.lead.id;

    const getRes = await request(app).get(`/api/leads/${bLeadId}`).set('Authorization', `Bearer ${ownerA.token}`);
    expect(getRes.status).toBe(404);
  });

  it('prevents business A from listing business B leads', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    await request(app).post('/api/leads').set('Authorization', `Bearer ${ownerB.token}`).send({ name: 'Only B', source: 'Website' });

    const listRes = await request(app).get('/api/leads').set('Authorization', `Bearer ${ownerA.token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.leads.find((l: { name: string }) => l.name === 'Only B')).toBeUndefined();
  });

  it('prevents business A from updating business B leads', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ name: 'B Lead 2', source: 'Website' });
    const bLeadId = createRes.body.lead.id;

    const updateRes = await request(app)
      .patch(`/api/leads/${bLeadId}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ status: 'Won' });
    expect(updateRes.status).toBe(404);
  });

  it('ignores a business_id supplied by the client and always uses the authenticated business', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Spoofed lead', source: 'Website', businessId: ownerB.businessId });

    expect(createRes.status).toBe(201);
    expect(createRes.body.lead.business_id).toBe(ownerA.businessId);
  });
});
