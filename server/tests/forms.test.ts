import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Lead capture forms', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('lets an owner create a form with fields', async () => {
    const owner = await signupOwner(app);
    const res = await request(app)
      .post('/api/forms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({
        name: 'Contact Us',
        fields: [
          { name: 'company', label: 'Company', type: 'text' },
          { name: 'budget', label: 'Budget', type: 'number', required: true },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.form.slug).toBeTruthy();
    expect(res.body.form.fields).toHaveLength(2);
  });

  it('includes each form\'s fields in the list endpoint (not just the detail endpoint)', async () => {
    const owner = await signupOwner(app);
    await request(app)
      .post('/api/forms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'List Fields Check', fields: [{ name: 'company', label: 'Company', type: 'text' }] });

    const listRes = await request(app).get('/api/forms').set('Authorization', `Bearer ${owner.token}`);
    expect(listRes.status).toBe(200);
    const form = listRes.body.forms.find((f: { name: string }) => f.name === 'List Fields Check');
    expect(Array.isArray(form.fields)).toBe(true);
    expect(form.fields).toHaveLength(1);
  });

  it('serves the form publicly without authentication and accepts a submission', async () => {
    const owner = await signupOwner(app);
    const createRes = await request(app)
      .post('/api/forms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Website Audit', fields: [{ name: 'company', label: 'Company', type: 'text' }] });

    const businessRes = await request(app).get('/api/business').set('Authorization', `Bearer ${owner.token}`);
    const businessSlug = businessRes.body.business.slug;
    const formSlug = createRes.body.form.slug;

    const publicGet = await request(app).get(`/api/public/forms/${businessSlug}/${formSlug}`);
    expect(publicGet.status).toBe(200);
    expect(publicGet.body.form.name).toBe('Website Audit');

    const submitRes = await request(app)
      .post(`/api/public/forms/${businessSlug}/${formSlug}/submit`)
      .send({
        name: 'Jane Visitor',
        email: 'jane@visitor-demo.com',
        fields: { company: 'Visitor Co' },
        utmSource: 'instagram',
        utmCampaign: 'launch',
      });
    expect(submitRes.status).toBe(201);
    expect(submitRes.body.success).toBe(true);

    const leadsRes = await request(app).get('/api/leads?search=Jane%20Visitor').set('Authorization', `Bearer ${owner.token}`);
    expect(leadsRes.body.leads).toHaveLength(1);
    expect(leadsRes.body.leads[0].source).toBe('Form');
    expect(leadsRes.body.leads[0].utm_source).toBe('instagram');
    expect(leadsRes.body.leads[0].utm_campaign).toBe('launch');
  });

  it('rejects a public submission missing a required custom field', async () => {
    const owner = await signupOwner(app);
    const createRes = await request(app)
      .post('/api/forms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Required Field Form', fields: [{ name: 'budget', label: 'Budget', type: 'number', required: true }] });

    const businessRes = await request(app).get('/api/business').set('Authorization', `Bearer ${owner.token}`);
    const res = await request(app)
      .post(`/api/public/forms/${businessRes.body.business.slug}/${createRes.body.form.slug}/submit`)
      .send({ name: 'Missing Budget', fields: {} });

    expect(res.status).toBe(400);
  });

  it('never exposes a disabled or nonexistent form publicly', async () => {
    const owner = await signupOwner(app);
    const createRes = await request(app)
      .post('/api/forms')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'To Disable', fields: [] });
    await request(app)
      .patch(`/api/forms/${createRes.body.form.id}`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ status: 'Disabled' });

    const businessRes = await request(app).get('/api/business').set('Authorization', `Bearer ${owner.token}`);
    const res = await request(app).get(`/api/public/forms/${businessRes.body.business.slug}/${createRes.body.form.slug}`);
    expect(res.status).toBe(404);
  });

  it('blocks sales users from creating forms (owner-only)', async () => {
    const owner = await signupOwner(app);
    const salesLoginRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Sales Rep', email: `formsales${Date.now()}@test.com`, password: 'password123', role: 'sales' });
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: salesLoginRes.body.user.email, password: 'password123' });

    const res = await request(app)
      .post('/api/forms')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Should Fail', fields: [] });
    expect(res.status).toBe(403);
  });
});
