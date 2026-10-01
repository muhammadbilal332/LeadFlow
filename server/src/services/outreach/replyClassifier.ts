import { ReplyClassification } from '../../repositories/emailReplyRepo';

const RULES: Array<{ classification: ReplyClassification; patterns: RegExp[] }> = [
  { classification: 'unsubscribe', patterns: [/unsubscribe/i, /remove me/i, /stop email(ing)?/i, /take me off/i, /opt out/i] },
  { classification: 'out_of_office', patterns: [/out of (the )?office/i, /\booo\b/i, /on vacation/i, /automatic reply/i, /auto-reply/i, /currently away/i] },
  { classification: 'meeting_request', patterns: [/schedule a call/i, /book a time/i, /calendly/i, /set up a call/i, /let'?s (meet|talk|chat)/i, /available (for a call|to talk)/i, /what time works/i] },
  { classification: 'not_interested', patterns: [/not interested/i, /no thanks/i, /not a fit/i, /please remove/i, /not looking/i, /no longer/i] },
  { classification: 'wrong_person', patterns: [/wrong person/i, /not the right (person|contact)/i, /reached the wrong/i] },
  { classification: 'referral', patterns: [/reach out to/i, /cc(ing|'d)? /i, /forwarding (this|you) to/i, /better contact/i, /talk to \w+ instead/i] },
  { classification: 'interested', patterns: [/interested/i, /tell me more/i, /sounds good/i, /sounds interesting/i, /would like to (learn|know) more/i, /yes,? let'?s/i] },
];

/**
 * Deterministic, keyword-based reply classification. Rule-based (not AI)
 * so behavior is predictable and testable — the same reply text always
 * classifies the same way, which matters for automatically stopping
 * follow-ups and deciding whether to create a lead.
 */
export function classifyReply(body: string): ReplyClassification {
  for (const rule of RULES) {
    if (rule.patterns.some((pattern) => pattern.test(body))) {
      return rule.classification;
    }
  }
  if (/\?/.test(body)) return 'question';
  return 'unknown';
}
