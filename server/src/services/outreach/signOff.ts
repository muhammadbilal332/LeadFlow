/**
 * Adds the sending salesperson's first name to an outgoing email's sign-off.
 *
 * Drafts are written before anyone approves them, so the sender is only known
 * at send time, from who approved the draft. The name goes in just before the
 * company signature ("Best,\nAlex\nNova Growth Agency"), or before the
 * unsubscribe footer if the company line isn't there. A body that already
 * ends with the first name is left alone, so re-sending never doubles it.
 */
export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0];
  return first ? first : null;
}

const UNSUBSCRIBE_FOOTER = '\n\n—\nNot interested?';

export function withSenderFirstName(body: string, firstName: string | null, companyName: string | null): string {
  if (!firstName) return body;

  const tail = body.slice(-200);
  if (tail.includes(`\n${firstName}\n`) || tail.endsWith(`\n${firstName}`)) return body;

  if (companyName && body.includes(`\n${companyName}`)) {
    return body.replace(`\n${companyName}`, `\nBest,\n${firstName}\n${companyName}`);
  }

  const footerAt = body.indexOf(UNSUBSCRIBE_FOOTER);
  if (footerAt !== -1) {
    return `${body.slice(0, footerAt)}\n\nBest,\n${firstName}${body.slice(footerAt)}`;
  }

  return `${body}\n\nBest,\n${firstName}`;
}
