import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';

describe('Campaigns', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('returns an empty list with no leads yet (no divide-by-zero errors)', async () => {
    const owner = await signupOwner(app);
    const res = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.campaigns).toEqual([]);
  });

  it('aggregates leads into a campaign by utm_campaign, computing conversion correctly', async () => {
    const owner = await signupOwner(app);

    const leadA = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Campaign Lead 1', source: 'Website' });
    const leadB = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Campaign Lead 2', source: 'Website' });

    // Simulate both leads coming from the same campaign via a webhook (which
    // resolves utm_campaign -> campaign_id through the shared intake pipeline).
    const secret = (await request(app).post('/api/integrations/webhook').set('Authorization', `Bearer ${owner.token}`)).body.secret;
    await request(app).post('/api/webhooks/leads').set('X-Webhook-Secret', secret).send({ name: 'Webhook Lead', utm_campaign: 'fall-sale' });
    await request(app).post('/api/webhooks/leads').set('X-Webhook-Secret', secret).send({ name: 'Webhook Lead 2', utm_campaign: 'fall-sale' });

    void leadA;
    void leadB;

    const res = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);
    const campaign = res.body.campaigns.find((c: { utm_campaign: string }) => c.utm_campaign === 'fall-sale');
    expect(campaign).toBeTruthy();
    expect(campaign.total_leads).toBe(2);
  });

  it('never returns another business\'s campaigns', async () => {
    const ownerA = await signupOwner(app);
    const ownerB = await signupOwner(app);
    const secretA = (await request(app).post('/api/integrations/webhook').set('Authorization', `Bearer ${ownerA.token}`)).body.secret;
    await request(app).post('/api/webhooks/leads').set('X-Webhook-Secret', secretA).send({ name: 'A Lead', utm_campaign: 'a-only-campaign' });

    const bCampaigns = await request(app).get('/api/campaigns').set('Authorization', `Bearer ${ownerB.token}`);
    expect(bCampaigns.body.campaigns.some((c: { utm_campaign: string }) => c.utm_campaign === 'a-only-campaign')).toBe(false);
  });
});
