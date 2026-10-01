import { wordCount } from './naturalCommunicationEngine';
import { QualityIssue, QualityStatus } from '../../repositories/outreachDraftRepo';
import * as suppressionRepo from '../../repositories/suppressionRepo';

const CTA_PATTERNS = [/\bworth a\b/i, /\bcall\b/i, /\bchat\b/i, /\bminutes?\b/i, /\btime this week\b/i, /\?\s*$/];
const SHORTENER_DOMAINS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly'];
const BARE_IP_LINK = /https?:\/\/\d{1,3}(\.\d{1,3}){3}/i;

export interface DraftForCheck {
  businessId: string;
  toEmail: string;
  normalizedToEmail: string;
  subject: string;
  body: string;
  previousBodies?: string[];
}

/**
 * Runs every send-readiness check on a draft. `blocked` means the draft
 * cannot be approved or sent until fixed; `warnings` means it can still be
 * approved by a human but the issue is surfaced for review; `passed` means
 * no issues at all. This never sends anything itself — it only classifies.
 */
export async function checkDraft(input: DraftForCheck): Promise<{ status: QualityStatus; issues: QualityIssue[] }> {
  const issues: QualityIssue[] = [];

  if (!input.toEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.toEmail)) {
    issues.push({ code: 'invalid_recipient', severity: 'blocking', message: 'Recipient email address is missing or invalid.' });
  }

  if (await suppressionRepo.isSuppressed(input.businessId, input.normalizedToEmail)) {
    issues.push({ code: 'suppressed_recipient', severity: 'blocking', message: 'This recipient is on the suppression list and cannot be emailed.' });
  }

  if (!input.subject.trim()) {
    issues.push({ code: 'missing_subject', severity: 'blocking', message: 'Subject line is empty.' });
  }

  const words = wordCount(input.body);
  if (words > 250) {
    issues.push({ code: 'too_long', severity: 'blocking', message: `Email is ${words} words — cold outreach should stay well under 250 words.` });
  } else if (words > 150) {
    issues.push({ code: 'long', severity: 'warning', message: `Email is ${words} words — consider trimming for a cold first-touch email.` });
  } else if (words < 20) {
    issues.push({ code: 'too_short', severity: 'warning', message: `Email is only ${words} words — may read as too thin.` });
  }

  const hasCta = CTA_PATTERNS.some((pattern) => pattern.test(input.body));
  if (!hasCta) {
    issues.push({ code: 'missing_cta', severity: 'warning', message: 'No clear call to action detected (e.g. a question or a suggested next step).' });
  }

  if (BARE_IP_LINK.test(input.body) || SHORTENER_DOMAINS.some((domain) => input.body.includes(domain))) {
    issues.push({ code: 'suspicious_link', severity: 'warning', message: 'Email contains a bare-IP or link-shortener URL, which increases spam risk.' });
  }

  if (input.previousBodies?.some((prev) => prev.trim() === input.body.trim())) {
    issues.push({ code: 'duplicate_content', severity: 'blocking', message: 'This draft is identical to a previous message sent to this contact.' });
  }

  const status: QualityStatus = issues.some((i) => i.severity === 'blocking') ? 'blocked' : issues.length > 0 ? 'warnings' : 'passed';
  return { status, issues };
}
