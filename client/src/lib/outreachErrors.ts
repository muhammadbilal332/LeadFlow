const PERSONAL_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'me.com', 'aol.com', 'protonmail.com', 'proton.me', 'gmx.com', 'yandex.com',
]);

/**
 * A sender address at gmail.com, yahoo.com, etc. can never pass as a
 * verified sending domain with a real provider (Resend, SES, etc.) — you
 * can only verify a domain you own, and nobody owns gmail.com but Google.
 * Used to warn before a campaign ever tries to send, rather than letting
 * the user discover it as a failed-send error afterward.
 */
export function isLikelyPersonalEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  return Boolean(domain && PERSONAL_EMAIL_DOMAINS.has(domain));
}

/**
 * Translates a raw provider send-failure string (e.g. Resend's JSON error
 * body) into something a non-technical user can act on. Falls back to the
 * raw reason — shown as a tooltip by the caller — when nothing matches.
 */
export function humanizeSendFailure(reason: string | null): string {
  if (!reason) return 'Send failed — no reason recorded.';

  if (/domain is not verified/i.test(reason)) {
    const domain = reason.match(/The ([\w.-]+) domain is not verified/i)?.[1];
    return domain
      ? `"${domain}" isn't a verified sending domain. Add and verify a domain you own in your email provider's dashboard, then set the sender email (Settings → Email) to an address at that domain.`
      : "The sender's domain isn't verified. Add and verify a domain you own in your email provider's dashboard, then update the sender email in Settings → Email.";
  }

  if (/only send testing emails to your own email address/i.test(reason)) {
    return "Your email provider is still in test mode and can only deliver to your own verified address. Verify a sending domain to send to real recipients.";
  }

  if (/no sender email configured/i.test(reason)) {
    return 'No sender email is configured for this campaign or your account. Set one in Settings → Email.';
  }

  if (/Resend is not configured|Brevo is not configured/i.test(reason)) {
    return 'The email provider is not configured — no API key is set.';
  }

  return reason;
}
