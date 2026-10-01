import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner, signupDeveloper } from './helpers';

describe('Developer/Admin Dashboard — business management & lead-view auditing', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('audits every view of the cross-tenant lead list, including which business/filter was viewed', async () => {
    const owner = await signupOwner(app);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    await request(app).get(`/api/developer/leads?businessId=${owner.businessId}`).set(auth);

    const auditRes = await request(app).get('/api/developer/audit').set(auth);
    const entry = auditRes.body.logs.find((l: any) => l.action === 'developer_viewed_leads');
    expect(entry).toBeTruthy();
    expect(entry.business_id).toBe(owner.businessId);
  });

  it('deactivating a business blocks its users from logging in, and reactivating restores access — both audited', async () => {
    const owner = await signupOwner(app);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const deactivateRes = await request(app).post(`/api/developer/businesses/${owner.businessId}/deactivate`).set(auth);
    expect(deactivateRes.status).toBe(200);
    expect(deactivateRes.body.business.is_active).toBe(false);

    // The owner's credentials are still correct, but their business is deactivated.
    const blockedLoginRes = await request(app).post('/api/auth/login').send({ email: owner.email, password: 'password123' });
    expect(blockedLoginRes.status).toBe(401);

    // Deactivating an already-deactivated business is rejected, not silently repeated.
    const doubleDeactivateRes = await request(app).post(`/api/developer/businesses/${owner.businessId}/deactivate`).set(auth);
    expect(doubleDeactivateRes.status).toBe(400);

    const reactivateRes = await request(app).post(`/api/developer/businesses/${owner.businessId}/reactivate`).set(auth);
    expect(reactivateRes.status).toBe(200);
    expect(reactivateRes.body.business.is_active).toBe(true);

    const restoredLoginRes = await request(app).post('/api/auth/login').send({ email: owner.email, password: 'password123' });
    expect(restoredLoginRes.status).toBe(200);

    const auditRes = await request(app).get('/api/developer/audit').set(auth);
    expect(auditRes.body.logs.some((l: any) => l.action === 'developer_deactivated_business' && l.target_id === owner.businessId)).toBe(true);
    expect(auditRes.body.logs.some((l: any) => l.action === 'developer_reactivated_business' && l.target_id === owner.businessId)).toBe(true);
  });

  it('refuses to delete an active business, but permanently deletes a deactivated one (cascading its data), and audits it', async () => {
    const owner = await signupOwner(app);
    const developer = await signupDeveloper(app);
    const auth = { Authorization: `Bearer ${developer.token}` };

    const deleteWhileActiveRes = await request(app).delete(`/api/developer/businesses/${owner.businessId}`).set(auth);
    expect(deleteWhileActiveRes.status).toBe(400);

    await request(app).post(`/api/developer/businesses/${owner.businessId}/deactivate`).set(auth);

    const deleteRes = await request(app).delete(`/api/developer/businesses/${owner.businessId}`).set(auth);
    expect(deleteRes.status).toBe(204);

    const businessesRes = await request(app).get('/api/developer/businesses').set(auth);
    expect(businessesRes.body.businesses.find((b: any) => b.id === owner.businessId)).toBeUndefined();

    const auditRes = await request(app).get('/api/developer/audit').set(auth);
    expect(auditRes.body.logs.some((l: any) => l.action === 'developer_deleted_business')).toBe(true);
  });
});
