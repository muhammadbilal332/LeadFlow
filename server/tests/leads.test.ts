import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Lead management', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('creates a lead with a computed score and a "Lead created" activity', async () => {
    const owner = await signupOwner(app);

    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Jordan Smith',
        company: 'Smith Co',
        email: 'jordan@smithco.test',
        phone: '555-9999',
        source: 'Referral',
        budget: 10000,
        timeline: 'ASAP',
        interestedIn: 'Custom software',
        description: 'A detailed description of what they need built for their team.',
      });

    expect(res.status).toBe(201);
    expect(res.body.lead.status).toBe('New');
    expect(res.body.lead.score).toBeGreaterThan(70);

    const activities = await request(app)
      .get(`/api/leads/${res.body.lead.id}/activities`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(activities.body.activities.some((a: { type: string }) => a.type === 'Lead created')).toBe(true);
  });

  it('rejects lead creation with missing required name', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ source: 'Website' });
    expect(res.status).toBe(422);
  });

  it('updates lead status and records a "Status changed" activity', async () => {
    const owner = await signupOwner(app);
    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Status Test', source: 'Website' });
    const leadId = createRes.body.lead.id;

    const updateRes = await request(app)
      .patch(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'Contacted' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.lead.status).toBe('Contacted');

    const activities = await request(app)
      .get(`/api/leads/${leadId}/activities`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(activities.body.activities.some((a: { type: string }) => a.type === 'Status changed')).toBe(true);
  });

  it('adds a note to a lead', async () => {
    const owner = await signupOwner(app);
    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Note Test', source: 'Website' });
    const leadId = createRes.body.lead.id;

    const noteRes = await request(app)
      .post(`/api/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Called and left a voicemail.' });
    expect(noteRes.status).toBe(201);
    expect(noteRes.body.note.content).toBe('Called and left a voicemail.');
  });

  it('paginates and filters the lead list by status', async () => {
    const owner = await signupOwner(app);
    for (let i = 0; i < 3; i++) {
      await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: `Lead ${i}`, source: 'Website' });
    }
    const res = await request(app).get('/api/leads?status=New&pageSize=2&page=1').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.leads.length).toBeLessThanOrEqual(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(3);
  });

  it('returns 404 for a nonexistent lead', async () => {
    const owner = await signupOwner(app);
    const res = await request(app)
      .get('/api/leads/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(404);
  });
});
