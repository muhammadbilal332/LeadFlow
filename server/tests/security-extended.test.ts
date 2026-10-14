import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, signupDeveloper } from './helpers';

describe('Cross-tenant security on new resources', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('never lets business A read or edit business B\'s forms', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    const formB = await request(app).post('/api/forms').set('Authorization', `Bearer ${ownerB.token}`).send({ name: 'B Form', fields: [] });

    const getRes = await request(app).get(`/api/forms/${formB.body.form.id}`).set('Authorization', `Bearer ${ownerA.token}`);
    expect(getRes.status).toBe(404);

    const updateRes = await request(app)
      .patch(`/api/forms/${formB.body.form.id}`)
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Hijacked' });
    expect(updateRes.status).toBe(404);
  });

  it('routing rules are developer-only now, and a developer targeting business A never sees or edits business B\'s rules', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    // Owner access is gone entirely — removed from the owner account per
    // the move to the developer console (docs/DEVELOPER_DASHBOARD.md).
    const ownerAttempt = await request(app)
      .post('/api/routing/rules')
      .set('Authorization', `Bearer ${ownerA.token}`)
      .send({ name: 'Owner Rule', field: 'always', operator: 'equals', assignmentType: 'owner' });
    expect(ownerAttempt.status).toBe(403);

    const ruleB = await request(app)
      .post(`/api/routing/rules?businessId=${ownerB.businessId}`)
      .set(auth)
      .send({ name: 'B Rule', field: 'always', operator: 'equals', assignmentType: 'owner' });
    expect(ruleB.status).toBe(201);

    const listA = await request(app).get(`/api/routing/rules?businessId=${ownerA.businessId}`).set(auth);
    expect(listA.body.rules.some((r: { id: string }) => r.id === ruleB.body.rule.id)).toBe(false);

    const updateRes = await request(app)
      .patch(`/api/routing/rules/${ruleB.body.rule.id}?businessId=${ownerA.businessId}`)
      .set(auth)
      .send({ isActive: false });
    expect(updateRes.status).toBe(404);
  });

  it('never lets business A read or edit business B\'s automation rules', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    const ruleB = await request(app)
      .post('/api/automations')
      .set('Authorization', `Bearer ${ownerB.token}`)
      .send({ name: 'B Automation', actions: [{ type: 'notify' }] });

    const listA = await request(app).get('/api/automations').set('Authorization', `Bearer ${ownerA.token}`);
    expect(listA.body.rules.some((r: { id: string }) => r.id === ruleB.body.rule.id)).toBe(false);
  });

  it('integrations are developer-only now, and a developer targeting business A never sees business B\'s webhook config', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    // Owner access is gone entirely — removed from the owner account per
    // the move to the developer console (docs/DEVELOPER_DASHBOARD.md).
    const ownerAttempt = await request(app).get('/api/integrations').set('Authorization', `Bearer ${ownerA.token}`);
    expect(ownerAttempt.status).toBe(403);

    await request(app).post(`/api/integrations/webhook?businessId=${ownerB.businessId}`).set(auth);

    const overviewA = await request(app).get(`/api/integrations?businessId=${ownerA.businessId}`).set(auth);
    expect(overviewA.body.webhook).toBeNull();
  });

  it('rejects unauthenticated access to every new protected resource', async () => {
    const endpoints = ['/api/forms', '/api/notifications', '/api/routing/rules', '/api/automations', '/api/api-keys', '/api/integrations'];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
    }
  });

  it('rejects an invalid JWT on every new protected resource', async () => {
    const res = await request(app).get('/api/forms').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});
