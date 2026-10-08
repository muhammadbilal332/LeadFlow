/**
 * Deterministic lead scoring.
 *
 * The score is a sum of independently-weighted signals, capped at 100:
 *   - Timeline provided:          +20  ("immediate"/"asap"/"this month" style urgency: +10 bonus)
 *   - Contact completeness:       +20  (+10 email present, +10 phone present)
 *   - Source quality:             +15  (Referral/Website score higher than cold sources)
 *   - Interest specified:         +15  (interested_in filled in)
 *   - Description completeness:   +15  (a real description was given)
 *
 * Buckets: 0-39 Cold, 40-69 Warm, 70-100 Hot.
 */

export interface ScorableLead {
  timeline?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  interestedIn?: string | null;
  description?: string | null;
}

const URGENT_TIMELINE_KEYWORDS = ['immediate', 'asap', 'this week', 'this month', 'urgent', 'now'];
const HIGH_QUALITY_SOURCES = ['Referral', 'Website'];

export function calculateLeadScore(lead: ScorableLead): number {
  let score = 0;

  if (lead.timeline && lead.timeline.trim().length > 0) {
    score += 10;
    const lower = lead.timeline.toLowerCase();
    if (URGENT_TIMELINE_KEYWORDS.some((kw) => lower.includes(kw))) {
      score += 10;
    }
  }

  if (lead.email && lead.email.trim().length > 0) score += 10;
  if (lead.phone && lead.phone.trim().length > 0) score += 10;

  if (lead.source && HIGH_QUALITY_SOURCES.includes(lead.source)) {
    score += 15;
  } else if (lead.source && lead.source !== 'Other') {
    score += 8;
  }

  if (lead.interestedIn && lead.interestedIn.trim().length > 0) {
    score += 15;
  }

  if (lead.description && lead.description.trim().length >= 20) {
    score += 15;
  } else if (lead.description && lead.description.trim().length > 0) {
    score += 7;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function qualificationFromScore(score: number): 'Hot' | 'Warm' | 'Cold' {
  if (score >= 70) return 'Hot';
  if (score >= 40) return 'Warm';
  return 'Cold';
}

/**
 * Lead Score priority band shown throughout the app (inbox, routing rules,
 * SLA targets). This is a transparent, deterministic label — not a
 * statistical prediction of anything.
 *   0-39 Low, 40-69 Medium, 70-84 High, 85-100 Hot
 */
export function priorityFromScore(score: number): 'Low' | 'Medium' | 'High' | 'Hot' {
  if (score >= 85) return 'Hot';
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  return 'Low';
}
