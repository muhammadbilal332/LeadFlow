import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createHmac } from 'crypto';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Generic inbound webhook (n8n / API)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('rejects a request with no webhook secret', async () => {
    const res = await request(app).post('/api/webhooks/leads').send({ name: 'No Secret' });
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid webhook secret', async () => {
    const res = await request(app).post('/api/webhooks/leads').set('X-Webhook-Secret', 'not-a-real-secret').send({ name: 'Bad Secret' });
    expect(res.status).toBe(401);
  });

  it('creates a lead through the full intake pipeline when the secret is valid', async () => {
    const owner = await signupOwner(app);
    const secretRes = await request(app).post('/api/integrations/webhook').set('Authorization', `Bearer ${owner.token}`);
    expect(secretRes.status).toBe(201);
    const secret = secretRes.body.secret as string;

    const res = await request(app)
      .post('/api/webhooks/leads')
      .set('X-Webhook-Secret', secret)
      .send({ name: 'Ahmed Khan', email: 'ahmed@example.com', source: 'instagram', utm_campaign: 'website-audit' });

    expect(res.status).toBe(201);
    expect(res.body.leadId).toBeTruthy();

    const leadsRes = await request(app).get('/api/leads?search=Ahmed').set('Authorization', `Bearer ${owner.token}`);
    expect(leadsRes.body.leads).toHaveLength(1);
    expect(leadsRes.body.leads[0].external_source).toBe('webhook');

    const deliveries = await request(app).get('/api/integrations/webhook/deliveries').set('Authorization', `Bearer ${owner.token}`);
    expect(deliveries.body.deliveries.length).toBeGreaterThan(0);
    expect(deliveries.body.deliveries[0].status).toBe('Success');
  });

  it("never lets one business's webhook secret create leads in a different business", async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);

    const secretA = (await request(app).post('/api/integrations/webhook').set('Authorization', `Bearer ${ownerA.token}`)).body.secret;

    await request(app).post('/api/webhooks/leads').set('X-Webhook-Secret', secretA).send({ name: 'Belongs To A' });

    const bLeads = await request(app).get('/api/leads?search=Belongs').set('Authorization', `Bearer ${ownerB.token}`);
    expect(bLeads.body.leads).toHaveLength(0);
  });

  it('rejects an invalid payload with a 422 and logs a failed delivery', async () => {
    const owner = await signupOwner(app);
    const secret = (await request(app).post('/api/integrations/webhook').set('Authorization', `Bearer ${owner.token}`)).body.secret;

    const res = await request(app).post('/api/webhooks/leads').set('X-Webhook-Secret', secret).send({});
    expect(res.status).toBe(422);
  });
});

describe('Meta (Facebook/Instagram) lead-ads webhook', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('responds to the GET verification challenge when the verify token matches', async () => {
    const res = await request(app).get('/api/webhooks/meta/leads').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects the GET verification challenge when the verify token is wrong', async () => {
    const res = await request(app).get('/api/webhooks/meta/leads').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': '12345',
    });
    expect(res.status).toBe(403);
  });

  it('rejects a POST payload with an invalid or missing signature', async () => {
    const res = await request(app)
      .post('/api/webhooks/meta/leads')
      .send({ object: 'page', entry: [] });
    expect(res.status).toBe(403);
  });

  it('accepts a correctly-signed payload and returns 200 even when no integration is configured for the page', async () => {
    const payload = { object: 'page', entry: [{ id: 'unconfigured-page', changes: [{ field: 'leadgen', value: { leadgen_id: 'lg_1', page_id: 'unconfigured-page' } }] }] };
    const rawBody = JSON.stringify(payload);
    const signature = 'sha256=' + createHmac('sha256', 'test-app-secret').update(rawBody).digest('hex');

    const res = await request(app).post('/api/webhooks/meta/leads').set('X-Hub-Signature-256', signature).set('Content-Type', 'application/json').send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
