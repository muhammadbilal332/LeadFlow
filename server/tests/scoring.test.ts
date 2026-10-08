import { describe, it, expect } from 'vitest';
import { calculateLeadScore, qualificationFromScore } from '../src/services/scoringService';

describe('Deterministic lead scoring', () => {
  it('scores a complete, urgent lead as Hot', () => {
    const score = calculateLeadScore({
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
