/**
 * Google service-account auth (JWT Bearer flow), hand-rolled with Node's
 * built-in `crypto` and `fetch` rather than the `googleapis` SDK — this
 * script handles a service-account private key, so keeping its dependency
 * tree as small and auditable as possible is a deliberate security choice,
 * not an oversight.
 *
 * Scope is always exactly `spreadsheets` — never `drive` or any broader
 * scope — so this credential can only ever read/write the one spreadsheet
 * it's explicitly shared with, nothing else in the account's Drive.
 */
import { createSign } from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/** Throws with a message that never includes the key material itself. */
export function parseServiceAccountJson(raw: string): ServiceAccountKey {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.client_email !== 'string' || !obj.client_email) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing "client_email"');
  }
  if (typeof obj.private_key !== 'string' || !obj.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is missing "private_key"');
  }
  return { client_email: obj.client_email, private_key: obj.private_key };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function signJwt(key: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: key.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = base64url(signer.sign(key.private_key));
  return `${unsigned}.${signature}`;
}

/** Exchanges the signed JWT for a short-lived (1 hour) OAuth2 access token. Never logs the token. */
export async function getAccessToken(key: ServiceAccountKey, fetchImpl: typeof fetch = fetch): Promise<string> {
  const assertion = signJwt(key);
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    // Google's error body can be verbose but never contains our secret; the
    // private key never leaves this process, only the one-time assertion did.
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error('Google token exchange response had no access_token');
  }
  return body.access_token;
}
