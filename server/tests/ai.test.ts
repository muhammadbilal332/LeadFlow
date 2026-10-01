import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { setupTestDatabase } from './testDb';
import { createApp } from '../src/app';
import { signupOwner } from './helpers';
import { isAiConfigured } from '../src/services/aiService';
import { calculateLeadScore, qualificationFromScore } from '../src/services/scoringService';

describe('AI qualification (no provider configured)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  const app = createApp();

  it('reports AI as not configured', () => {
    expect(isAiConfigured()).toBe(false);
  });

  it('does not crash the app and returns a clear 422 message when AI is not configured', async () => {
    const owner = await signupOwner(app);
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'AI Test Lead', source: 'Website' });

    const res = await request(app)
      .post(`/api/leads/${leadRes.body.lead.id}/qualify-ai`)
      .set('Authorization', `Bearer ${owner.token}`);

    expect(res.status).toBe(422);
    expect(res.body.configured).toBe(false);
    expect(res.body.error).toMatch(/not configured/i);
  });

  it('still allows normal CRM functionality (lead retrieval) alongside a disabled AI feature', async () => {
    const owner = await signupOwner(app);
    const leadRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Still Works', source: 'Website' });
    const getRes = await request(app).get(`/api/leads/${leadRes.body.lead.id}`).set('Authorization', `Bearer ${owner.token}`);
    expect(getRes.status).toBe(200);
  });
});

describe('Deterministic lead scoring', () => {
  it('scores a complete, urgent, high-budget lead as Hot', () => {
    const score = calculateLeadScore({
      budget: 10000,
      timeline: 'ASAP',
      email: 'a@b.com',
      phone: '555-1234',
      source: 'Referral',
      interestedIn: 'Full platform build',
      description: 'A long, thoughtful description of the business need and desired outcome.',
    });
    expect(qualificationFromScore(score)).toBe('Hot');
  });

  it('scores an empty lead as Cold', () => {
    const score = calculateLeadScore({});
    expect(qualificationFromScore(score)).toBe('Cold');
    expect(score).toBe(0);
  });

  it('never exceeds 100', () => {
    const score = calculateLeadScore({
      budget: 999999,
      timeline: 'ASAP this week urgent now',
      email: 'a@b.com',
      phone: '555-1234',
      source: 'Referral',
      interestedIn: 'Everything',
      description: 'x'.repeat(200),
    });
    expect(score).toBeLessThanOrEqual(100);
  });
});
