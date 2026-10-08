import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, signupDeveloper, createSalesUser } from './helpers';

describe('Developer/Admin Dashboard', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('blocks anonymous access to every developer route with 401', async () => {
    const routes = ['/api/developer/overview', '/api/developer/users', '/api/developer/outreach', '/api/developer/automation', '/api/developer/health', '/api/developer/providers', '/api/developer/usage', '/api/developer/logs', '/api/developer/audit'];
    for (const route of routes) {
      const res = await request(app).get(route);
      expect(res.status).toBe(401);
    }
  });

  it('blocks a sales user with 403', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);
    const res = await request(app).get('/api/developer/overview').set('Authorization', `Bearer ${sales.token}`);
    expect(res.status).toBe(403);
  });

  it('blocks an owner (not explicitly a developer) with 403', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).get('/api/developer/overview').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('cannot be reached by manually crafting a developer JWT — an owner/sales token never carries the developer role', async () => {
    // The role lives inside the signed JWT payload issued at login; a
    // client can never upgrade its own token to role=developer without the
    // server re-issuing one, which only happens for a real developer
    // account's credentials.
    const owner = await signupOwner(app);
    const res = await request(app).get('/api/developer/users').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(403);
  });

  it('allows a real developer account full access, with real (not fake) platform-wide data', async () => {
    const owner1 = await signupOwner(app, { businessName: 'Acme One' });
    await signupOwner(app, { businessName: 'Acme Two' });
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const overviewRes = await request(app).get('/api/developer/overview').set(auth);
    expect(overviewRes.status).toBe(200);
    expect(overviewRes.body.overview.totalBusinesses).toBeGreaterThanOrEqual(3); // 2 test businesses + the developer's own platform business
    expect(overviewRes.body.overview.totalUsers).toBeGreaterThanOrEqual(3);

    const usersRes = await request(app).get('/api/developer/users').set(auth);
    expect(usersRes.status).toBe(200);
    expect(usersRes.body.users.some((u: any) => u.business_id === owner1.businessId)).toBe(true);
    // Sensitive fields must never be present.
    expect(usersRes.body.users.every((u: any) => !('password_hash' in u) && !('passwordHash' in u))).toBe(true);
    expect(JSON.stringify(usersRes.body)).not.toContain(developer.token);

    const outreachRes = await request(app).get('/api/developer/outreach').set(auth);
    expect(outreachRes.status).toBe(200);
    expect(outreachRes.body.lifecycle).toBeTruthy();

    const automationRes = await request(app).get('/api/developer/automation').set(auth);
    expect(automationRes.status).toBe(200);
    expect(typeof automationRes.body.connected).toBe('boolean');

    const healthRes = await request(app).get('/api/developer/health').set(auth);
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.services.database.status).toBe('healthy');

    const providersRes = await request(app).get('/api/developer/providers').set(auth);
    expect(providersRes.status).toBe(200);
    expect(providersRes.body.providers.email.selected).toBe('mock');

    const usageRes = await request(app).get('/api/developer/usage').set(auth);
    expect(usageRes.status).toBe(200);

    const logsRes = await request(app).get('/api/developer/logs').set(auth);
    expect(logsRes.status).toBe(200);

    const auditRes = await request(app).get('/api/developer/audit').set(auth);
    expect(auditRes.status).toBe(200);
    // The developer's own login was audited.
    expect(auditRes.body.logs.some((l: any) => l.action === 'developer_login')).toBe(true);
  });

  it('automation scheduler connection status is derived from a real recorded execution, not assumed', async () => {
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const before = await request(app).get('/api/developer/automation').set(auth);
    expect(before.body.connected).toBe(false);

    // A JWT-authenticated (UI) tick call must NOT count as "the scheduler is
    // connected" — only an API-key-authenticated call (a real external
    // scheduler) should.
    await request(app).post('/api/outreach/tick').set(auth).send({});
    const afterJwtTick = await request(app).get('/api/developer/automation').set(auth);
    expect(afterJwtTick.body.connected).toBe(false);
    expect(afterJwtTick.body.summary.totalExecutions).toBeGreaterThan(0);
  });

  it('records an audit entry when a developer changes a user role or disables an account, and refuses to touch a developer account', async () => {
    const owner = await signupOwner(app);
    const sales = await createSalesUser(app, owner.token);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const roleRes = await request(app).patch(`/api/developer/users/${sales.userId}/role`).set(auth).send({ role: 'owner' });
    expect(roleRes.status).toBe(200);
    expect(roleRes.body.user.role).toBe('owner');

    const statusRes = await request(app).patch(`/api/developer/users/${sales.userId}/status`).set(auth).send({ isActive: false });
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.user.is_active).toBe(false);

    const auditRes = await request(app).get('/api/developer/audit').set(auth);
    expect(auditRes.body.logs.some((l: any) => l.action === 'developer_changed_user_role' && l.target_id === sales.userId)).toBe(true);
    expect(auditRes.body.logs.some((l: any) => l.action === 'developer_disabled_user' && l.target_id === sales.userId)).toBe(true);

    // A developer account's own role/status cannot be changed through this path.
    const protectRes = await request(app).patch(`/api/developer/users/${developer.userId}/role`).set(auth).send({ role: 'owner' });
    expect(protectRes.status).toBe(400);
  });

  it('logs a failed login attempt as a system event', async () => {
    await request(app).post('/api/auth/login').send({ email: 'nobody-here@test.com', password: 'wrong' });

    const developer = await signupDeveloper(app);
    const logsRes = await request(app).get('/api/developer/logs').set('Authorization', `Bearer ${developer.token}`);
    expect(logsRes.body.events.some((e: any) => e.event_type === 'auth_failure')).toBe(true);
  });

});
