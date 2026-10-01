import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, createSalesUser } from './helpers';

describe('Reports and dashboard aggregates', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('computes per-salesperson won/lost counts independently, not equal to their total leads', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    const leads = [
      { name: 'Won Lead', status: 'Won' },
      { name: 'Lost Lead', status: 'Lost' },
      { name: 'Open Lead 1', status: 'Contacted' },
      { name: 'Open Lead 2', status: 'Qualified' },
    ];

    for (const l of leads) {
      const createRes = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name: l.name, source: 'Website', assignedUserId: sales.userId });
      await request(app)
        .patch(`/api/leads/${createRes.body.lead.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ status: l.status });
    }

    const res = await request(app).get('/api/reports').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const perf = res.body.salespersonPerformance.find((p: { userId: string }) => p.userId === sales.userId);
    expect(perf).toBeTruthy();
    expect(perf.totalLeads).toBe(4);
    expect(perf.won).toBe(1);
    expect(perf.lost).toBe(1);
  });

  it('reports dashboard KPIs that are internally consistent (won + lost <= total)', async () => {
    const owner = await signupOwner(app);
    await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Dashboard Lead', source: 'Website' });

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.kpis.wonDeals + res.body.kpis.lostDeals).toBeLessThanOrEqual(res.body.kpis.totalLeads);
  });
});
