import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Follow-ups', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  async function makeLead(token: string) {
    const res = await request(app).post('/api/leads').set('Authorization', `Bearer ${token}`).send({ name: 'Followup Lead', source: 'Website' });
    return res.body.lead.id as string;
  }

  it('creates a follow-up for a lead', async () => {
    const owner = await signupOwner(app);
    const leadId = await makeLead(owner.token);

    const res = await request(app)
      .post('/api/follow-ups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ leadId, type: 'Call', scheduledAt: new Date(Date.now() + 86400000).toISOString(), notes: 'Discuss pricing' });

    expect(res.status).toBe(201);
    expect(res.body.followUp.type).toBe('Call');
  });

  it('rejects a follow-up for a lead in another business', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);
    const leadId = await makeLead(ownerB.token);

    const res = await request(app)
      .post('/api/follow-ups')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ leadId, type: 'Call', scheduledAt: new Date().toISOString() });

    expect(res.status).toBe(404);
  });

  it('marks a follow-up completed and records an activity', async () => {
    const owner = await signupOwner(app);
    const leadId = await makeLead(owner.token);

    const createRes = await request(app)
      .post('/api/follow-ups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ leadId, type: 'Email', scheduledAt: new Date().toISOString() });

    const completeRes = await request(app)
      .patch(`/api/follow-ups/${createRes.body.followUp.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ completed: true });

    expect(completeRes.status).toBe(200);
    expect(completeRes.body.followUp.completed_at).toBeTruthy();
  });

  it('lists follow-ups filtered by status', async () => {
    const owner = await signupOwner(app);
    const leadId = await makeLead(owner.token);
    await request(app)
      .post('/api/follow-ups')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ leadId, type: 'Call', scheduledAt: new Date(Date.now() + 86400000).toISOString() });

    const res = await request(app).get('/api/follow-ups?status=upcoming').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.followUps)).toBe(true);
  });
});
