import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, createSalesUser } from './helpers';

describe('Central lead intake: duplicate detection & merge', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('merges a second lead with the same email into the existing one instead of creating a duplicate', async () => {
    const owner = await signupOwner(app);

    const first = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Original Lead', email: 'dup@example.com', source: 'Website' });
    expect(first.status).toBe(201);
    expect(first.body.isDuplicate).toBe(false);

    const second = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Duplicate Submission', email: 'DUP@example.com', source: 'Website' });
    expect(second.status).toBe(201);
    expect(second.body.isDuplicate).toBe(true);
    expect(second.body.duplicateOfLeadId).toBe(first.body.lead.id);
    expect(second.body.lead.id).toBe(first.body.lead.id);

    const list = await request(app).get('/api/leads?page=1&pageSize=100').set('Authorization', `Bearer ${owner.token}`);
    expect(list.body.pagination.total).toBe(1);

    // Email matches are merged outright, so nothing is left waiting for review.
    const dupList = await request(app).get('/api/leads/duplicates').set('Authorization', `Bearer ${owner.token}`);
    expect(dupList.body.duplicates).toHaveLength(0);
  });

  it('matches duplicates by normalized phone number too, regardless of formatting', async () => {
    const owner = await signupOwner(app);
    await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Phone One', phone: '(555) 123-4567', source: 'Phone' });
    const second = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Phone Two', phone: '555-123-4567', source: 'Phone' });

    expect(second.body.isDuplicate).toBe(true);
  });

  it('merges a duplicate into the target lead, preserving notes and marking the source as merged', async () => {
    const owner = await signupOwner(app);
    const source = await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Source Lead', source: 'Website' });
    const target = await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Target Lead', source: 'Website' });

    await request(app)
      .post(`/api/leads/${source.body.lead.id}/notes`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'Note on the source lead' });

    const mergeRes = await request(app)
      .post('/api/leads/merge')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ sourceLeadId: source.body.lead.id, targetLeadId: target.body.lead.id });
    expect(mergeRes.status).toBe(200);

    const targetNotes = await request(app).get(`/api/leads/${target.body.lead.id}/notes`).set('Authorization', `Bearer ${owner.token}`);
    expect(targetNotes.body.notes.some((n: { content: string }) => n.content === 'Note on the source lead')).toBe(true);

    // The source lead itself is never deleted — it stays as an audit record.
    const sourceStillExists = await request(app).get(`/api/leads/${source.body.lead.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(sourceStillExists.status).toBe(200);
  });
});

describe('Central lead intake: scoring, priority, and SLA', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('assigns a priority band consistent with the deterministic score', async () => {
    const owner = await signupOwner(app);
    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Hot Prospect',
        email: 'hot@example.com',
        phone: '555-999-1111',
        source: 'Referral',
        timeline: 'ASAP',
        interestedIn: 'Everything',
        description: 'A very detailed, thorough description of exactly what this prospect needs from us.',
      });

    expect(res.body.lead.score).toBeGreaterThanOrEqual(85);
    expect(res.body.lead.priority).toBe('Hot');
    expect(res.body.lead.sla_due_at).toBeTruthy();
    expect(res.body.lead.sla_status).toBe('Pending');
  });

  it('marks SLA as Met when the lead is first contacted before its due date', async () => {
    const owner = await signupOwner(app);
    const createRes = await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Respond Fast', source: 'Website' });

    const updateRes = await request(app)
      .patch(`/api/leads/${createRes.body.lead.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'Contacted' });

    expect(updateRes.body.lead.sla_status).toBe('Met');
    expect(updateRes.body.lead.first_contact_at).toBeTruthy();
  });
});

describe('Central lead intake: automatic assignment (routing rules & round robin)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('assigns a lead to a specific user when a matching "user" routing rule exists', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    await request(app)
      .post('/api/routing/rules')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Instagram to rep', priority: 0, field: 'source', operator: 'equals', value: 'Instagram', assignmentType: 'user', assignUserId: sales.userId });

    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'IG Lead', source: 'Instagram' });

    expect(leadRes.body.lead.assigned_user_id).toBe(sales.userId);
  });

  it('rotates round-robin assignment across active sales users', async () => {
    const owner = await signupOwner(app);
    const salesA = await createSalesUser(app, owner.token);
    const salesB = await createSalesUser(app, owner.token);

    await request(app)
      .post('/api/routing/rules')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Round robin all', priority: 0, field: 'always', operator: 'equals', assignmentType: 'round_robin' });

    const assignees: string[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/api/leads')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ name: `RR Lead ${i}`, source: 'Website' });
      assignees.push(res.body.lead.assigned_user_id);
    }

    expect(new Set(assignees)).toEqual(new Set([salesA.userId, salesB.userId]));
    // Alternates rather than assigning the same person every time.
    expect(assignees[0]).not.toBe(assignees[1]);
  });

  it('creates an automatic follow-up when a lead is assigned via routing', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);
    await request(app)
      .post('/api/routing/rules')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Always to rep', priority: 0, field: 'always', operator: 'equals', assignmentType: 'user', assignUserId: sales.userId });

    const leadRes = await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Needs Followup', source: 'Website' });

    const followUps = await request(app).get(`/api/leads/${leadRes.body.lead.id}/follow-ups`).set('Authorization', `Bearer ${owner.token}`);
    expect(followUps.body.followUps.length).toBeGreaterThan(0);
  });
});

describe('Central lead intake: automation rules', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('runs an automation rule that assigns high-scoring leads to a specific user', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);

    await request(app)
      .post('/api/automations')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Escalate hot leads',
        conditions: [{ field: 'score', operator: 'gte', value: '85' }],
        actions: [{ type: 'assign_user', userId: sales.userId }],
      });

    const res = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Automation Target',
        email: 'auto@example.com',
        phone: '555-222-3333',
        source: 'Referral',
        timeline: 'ASAP',
        interestedIn: 'Everything',
        description: 'A very detailed and complete description of the need and urgency here.',
      });

    expect(res.body.lead.score).toBeGreaterThanOrEqual(85);
    expect(res.body.lead.assigned_user_id).toBe(sales.userId);
  });
});
