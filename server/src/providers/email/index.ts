import { env } from '../../config/env';
import { EmailProvider } from './EmailProvider';
import { MockEmailProvider } from './MockEmailProvider';
import { ResendEmailProvider } from './ResendEmailProvider';
import { BrevoEmailProvider } from './BrevoEmailProvider';

const mockProvider = new MockEmailProvider();
const resendProvider = new ResendEmailProvider();
const brevoProvider = new BrevoEmailProvider();

/** Selected purely by EMAIL_PROVIDER — swap providers with zero code changes. */
export function getEmailProvider(): EmailProvider {
  if (env.EMAIL_PROVIDER === 'resend') return resendProvider;
  if (env.EMAIL_PROVIDER === 'brevo') return brevoProvider;
  return mockProvider;
}

export * from './EmailProvider';
