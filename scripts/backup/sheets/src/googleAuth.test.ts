import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { parseServiceAccountJson, getAccessToken } from './googleAuth.js';

function testKeyPem(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
}

describe('parseServiceAccountJson', () => {
  it('rejects invalid JSON without echoing the input', () => {
    const badInput = 'not json at all {{{';
    try {
      parseServiceAccountJson(badInput);
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/not valid JSON/);
      expect(message).not.toContain(badInput);
    }
  });

  it('rejects JSON missing client_email', () => {
    expect(() => parseServiceAccountJson(JSON.stringify({ private_key: 'x' }))).toThrow(/client_email/);
  });

  it('rejects JSON missing private_key, and the error never contains the partial object content', () => {
    const input = JSON.stringify({ client_email: 'bot@project.iam.gserviceaccount.com' });
    try {
      parseServiceAccountJson(input);
      expect.unreachable();
    } catch (err) {
      const message = (err as Error).message;
      expect(message).toMatch(/private_key/);
      expect(message).not.toContain('bot@project.iam.gserviceaccount.com');
    }
  });

  it('accepts a well-formed key object', () => {
    const key = parseServiceAccountJson(JSON.stringify({ client_email: 'bot@project.iam.gserviceaccount.com', private_key: 'fake' }));
    expect(key.client_email).toBe('bot@project.iam.gserviceaccount.com');
  });
});

describe('getAccessToken', () => {
  it('exchanges a signed JWT for an access token via the real token endpoint shape', async () => {
    const key = { client_email: 'bot@project.iam.gserviceaccount.com', private_key: testKeyPem() };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'fake-short-lived-token', expires_in: 3600 }),
    });
    const token = await getAccessToken(key, fetchMock as unknown as typeof fetch);
    expect(token).toBe('fake-short-lived-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const body = (init.body as URLSearchParams).toString();
    expect(body).toContain('grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer');
    const assertion = new URLSearchParams(body).get('assertion')!;
    expect(assertion.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('throws with a safe message (no secret material) when the token endpoint rejects the request', async () => {
    const key = { client_email: 'bot@project.iam.gserviceaccount.com', private_key: testKeyPem() };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'invalid_grant',
    });
    await expect(getAccessToken(key, fetchMock as unknown as typeof fetch)).rejects.toThrow(/HTTP 401/);
  });

  it('throws when the response has no access_token', async () => {
    const key = { client_email: 'bot@project.iam.gserviceaccount.com', private_key: testKeyPem() };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await expect(getAccessToken(key, fetchMock as unknown as typeof fetch)).rejects.toThrow(/no access_token/);
  });
});
