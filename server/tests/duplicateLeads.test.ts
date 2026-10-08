import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('One lead per email address', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('merges a second submission with the same email into the existing lead instead of creating another', async () => {
    const owner = await signupOwner(app);
    const auth = { Authorization: `Bearer ${owner.token}` };
    const email = `Dana.${Date.now()}@Brightleaf.test`;

    const first = await request(app).post('/api/leads').set(auth).send({ name: 'Dana Prospect', email, source: 'Website' });
    expect(first.status).toBe(201);
    expect(first.body.isDuplicate).toBe(false);

    const second = await request(app)
      .post('/api/leads')
      .set(auth)
      .send({ name: 'Dana Again', email: email.toUpperCase(), company: 'Brightleaf Roasters', phone: '+15551234567', source: 'Website' });
    expect(second.status).toBe(201);
    expect(second.body.isDuplicate).toBe(true);
    expect(second.body.duplicateOfLeadId).toBe(first.body.lead.id);
    expect(second.body.lead.id).toBe(first.body.lead.id);
    // Blank fields on the existing lead are filled from the new submission.
    expect(second.body.lead.company).toBe('Brightleaf Roasters');
    expect(second.body.lead.phone).toBe('+15551234567');

    const list = await request(app).get('/api/leads?page=1&pageSize=100').set(auth);
    const matching = list.body.leads.filter((l: { email: string | null }) => l.email?.toLowerCase() === email.toLowerCase());
    expect(matching).toHaveLength(1);
  });
});
