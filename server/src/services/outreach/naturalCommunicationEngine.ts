/**
 * Natural Communication Engine — a deterministic post-processing pass that
 * runs on every AI-generated draft (mock or real) before it reaches quality
 * checks. It never adds facts; it only reshapes tone/length/format so the
 * email reads like something a person actually typed, regardless of which
 * AI provider produced the raw text.
 */

const BANNED_PHRASES = [
  'circle back', 'touch base', 'synergy', 'synergies', 'leverage our', 'leveraging',
  'reaching out to connect', 'hope this email finds you well', 'in today\'s fast-paced',
  'game changer', 'game-changer', 'best-in-class', 'world-class', 'cutting-edge',
  'revolutionize', 'disrupt the industry', 'take it to the next level', 'low-hanging fruit',
  'move the needle', 'value add', 'value-add', 'think outside the box',
];

export interface NaturalizeResult {
  body: string;
  changes: string[];
}

function stripBannedPhrases(text: string): { text: string; removed: string[] } {
  let result = text;
  const removed: string[] = [];
  for (const phrase of BANNED_PHRASES) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    if (re.test(result)) {
      removed.push(phrase);
      result = result.replace(re, '').replace(/\s{2,}/g, ' ');
    }
  }
  return { text: result, removed };
}

function collapseLongParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => {
      const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
      if (sentences.length <= 3) return paragraph;
      // Break an overly long paragraph into shorter ones — natural email
      // writing rarely runs more than 2-3 sentences per paragraph.
      const chunks: string[] = [];
      for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(' '));
      }
      return chunks.join('\n\n');
    })
    .join('\n\n');
}

function trimExcessiveExclamation(text: string): string {
  return text.replace(/!{2,}/g, '!').replace(/(\w)!(?=\s|$)/g, (_match, letter) => `${letter}.`);
}

/** Applies tone/length/format rules to a raw AI draft. Never invents or removes factual content — only reshapes it. */
export function naturalizeEmail(rawBody: string): NaturalizeResult {
  const changes: string[] = [];

  let text = rawBody.trim();

  const { text: stripped, removed } = stripBannedPhrases(text);
  text = stripped;
  if (removed.length > 0) changes.push(`removed corporate phrases: ${removed.join(', ')}`);

  const beforeExclaim = text;
  text = trimExcessiveExclamation(text);
  if (text !== beforeExclaim) changes.push('reduced exclamation-mark enthusiasm');

  const beforeParagraphs = text;
  text = collapseLongParagraphs(text);
  if (text !== beforeParagraphs) changes.push('broke up long paragraphs');

  text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  return { body: text, changes };
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
