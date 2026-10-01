import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('CSV import/export', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('imports valid rows and reports invalid ones without crashing', async () => {
    const owner = await signupOwner(app);
    const csv = [
      'name,company,email,phone,source,industry,interested_in,budget,timeline,description',
      'Valid Lead,Acme,valid@acme.test,555-1111,Website,Retail,Website redesign,5000,This month,Needs help',
      ',Missing Name Co,,,,,,,,',
      'Another Valid,Beta,valid2@beta.test,555-2222,Referral,Finance,CRM,8000,ASAP,Urgent need',
    ].join('\n');

    const res = await request(app).post('/api/leads/import').set('Authorization', `Bearer ${owner.token}`).send({ csv });

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors.length).toBe(1);
  });

  it('assigns the authenticated business to every imported lead, not a client-supplied one', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);
    const csv = 'name,source\nImported Into A,Website';

    await request(app).post('/api/leads/import').set('Authorization', `Bearer ${ownerA.token}`).send({ csv });

    const listA = await request(app).get('/api/leads?search=Imported').set('Authorization', `Bearer ${ownerA.token}`);
    const listB = await request(app).get('/api/leads?search=Imported').set('Authorization', `Bearer ${ownerB.token}`);

    expect(listA.body.leads.length).toBe(1);
    expect(listB.body.leads.length).toBe(0);
  });

  it('exports only the current business leads as CSV', async () => {
    const owner = await signupOwner(app);
    await request(app).post('/api/leads').set('Authorization', `Bearer ${owner.token}`).send({ name: 'Export Me', source: 'Website' });

    const res = await request(app).get('/api/leads/export').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toContain('Export Me');
  });
});
