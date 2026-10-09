import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, createSalesUser } from './helpers';

describe('Role-based authorization', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('blocks sales users from listing users (owner-only)', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const res = await request(app).get('/api/users').set('Authorization', `Bearer ${sales.token}`);
    expect(res.status).toBe(403);
  });

  it('blocks sales users from creating users', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${sales.token}`)
      .send({ name: 'New Sales', email: `x${Date.now()}@test.com`, password: 'password123', role: 'sales' });
    expect(res.status).toBe(403);
  });

  it('blocks sales users from updating business settings', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const res = await request(app)
      .patch('/api/business')
      .set('Authorization', `Bearer ${sales.token}`)
      .send({ name: 'Hacked Name' });
    expect(res.status).toBe(403);
  });

  it('blocks sales users from deleting leads', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'To Delete', source: 'Website', assignedUserId: sales.userId });

    const res = await request(app)
      .delete(`/api/leads/${createRes.body.lead.id}`)
      .set('Authorization', `Bearer ${sales.token}`);
    expect(res.status).toBe(403);
  });

  it('restricts sales users to only their assigned leads', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const unassigned = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Unassigned Lead', source: 'Website' });

    const res = await request(app)
      .get(`/api/leads/${unassigned.body.lead.id}`)
      .set('Authorization', `Bearer ${sales.token}`);
    expect(res.status).toBe(403);
  });

  it('allows owners to access any lead in their business', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Owner Visible Lead', source: 'Website', assignedUserId: sales.userId });

    const res = await request(app)
      .get(`/api/leads/${leadRes.body.lead.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
  });

  it('blocks sales users from the Reports page (owner/manager-only)', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const res = await request(app).get('/api/reports').set('Authorization', `Bearer ${sales.token}`);
    expect(res.status).toBe(403);

    const ownerRes = await request(app).get('/api/reports').set('Authorization', `Bearer ${owner.token}`);
    expect(ownerRes.status).toBe(200);
  });

  it('rejects requests with no authentication token on protected routes', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });

  it('rejects requests with a malformed/invalid JWT', async () => {
    const res = await request(app).get('/api/leads').set('Authorization', 'Bearer totally.invalid.jwt');
    expect(res.status).toBe(401);
  });
});
