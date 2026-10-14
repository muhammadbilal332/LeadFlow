import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

function testKeyJson(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return JSON.stringify({ client_email: 'bot@project.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() });
}

/** Routes a fetch call to a canned response based on method + URL substring. No real network call is ever made. */
function makeFetchRouter(routes: Array<{ match: (url: string, init?: RequestInit) => boolean; respond: () => unknown }>) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) throw new Error(`No mock route matched: ${init?.method ?? 'GET'} ${url}`);
    const body = route.respond();
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  });
  return { fn, calls };
}

const BASE_ROUTES = [
  { match: (url: string) => url.includes('oauth2.googleapis.com/token'), respond: () => ({ access_token: 'fake-token' }) },
  { match: (url: string, init?: RequestInit) => !init?.method && !/:(?:batchUpdate|append|clear)/.test(url) && !url.includes('/values/'), respond: () => ({ sheets: [{ properties: { sheetId: 1, title: 'Backup Log', gridProperties: { rowCount: 1000, columnCount: 26 } } }] }) },
];

describe('logBackupManifest.run', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    delete process.env.BACKUP_STATUS;
  });

  it('fails safely when required secrets are missing, without attempting any network call', async () => {
    const { fn } = makeFetchRouter(BASE_ROUTES);
    globalThis.fetch = fn as unknown as typeof fetch;
    const { run } = await import('./logBackupManifest.js');

    await expect(run({})).rejects.toThrow(/missing required environment variable/);
    expect(fn).not.toHaveBeenCalled();
  });

  it('writes a header row once, then appends a success row, never clearing or overwriting history', async () => {
    const appendCalls: unknown[] = [];
    const updateCalls: unknown[] = [];
    const { fn } = makeFetchRouter([
      ...BASE_ROUTES,
      { match: (url: string, init?: RequestInit) => url.includes('/values/Backup%20Log!A1%3AI1') && !init?.method, respond: () => ({ values: [] }) }, // empty header check (GET only)
      { match: (url: string, init?: RequestInit) => url.includes('/values/Backup%20Log!A2%3AC') && !init?.method, respond: () => ({ values: [] }) }, // no prior rows (GET only)
      {
        match: (url: string, init?: RequestInit) => url.includes(':append'),
        respond: () => {
          appendCalls.push(1);
          return {};
        },
      },
      {
        match: (url: string, init?: RequestInit) => init?.method === 'PUT',
        respond: () => {
          updateCalls.push(1);
          return {};
        },
      },
    ]);
    globalThis.fetch = fn as unknown as typeof fetch;
    const { run } = await import('./logBackupManifest.js');

    await run({
      GOOGLE_SERVICE_ACCOUNT_JSON: testKeyJson(),
      GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-123',
      BACKUP_STATUS: 'success',
      BACKUP_OBJECT_KEY: 'leadflow/database/2026/10/14/leadflow-20261014T000000Z.dump',
      BACKUP_SIZE_BYTES: '123456',
      BACKUP_SHA256: 'abc123',
      BACKUP_DURATION_SECONDS: '7',
      GITHUB_RUN_ID: '42',
      GITHUB_RUN_ATTEMPT: '1',
    } as unknown as NodeJS.ProcessEnv);

    expect(updateCalls).toHaveLength(1); // header write only
    expect(appendCalls).toHaveLength(1); // the data row
  });

  it('records a failed backup attempt as status=failure, never silently reporting success', async () => {
    let appendedRow: string[] | undefined;
    const { fn } = makeFetchRouter([
      ...BASE_ROUTES,
      { match: (url: string) => url.includes('/values/Backup%20Log!A1%3AI1'), respond: () => ({ values: [['timestamp_utc']] }) }, // header already present
      { match: (url: string) => url.includes('/values/Backup%20Log!A2%3AC'), respond: () => ({ values: [] }) },
      {
        match: (url: string, init?: RequestInit) => url.includes(':append'),
        respond: () => ({}),
      },
    ]);
    // Capture the append body specifically.
    const fnWithCapture = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes(':append') && init?.body) {
        appendedRow = (JSON.parse(init.body as string).values as string[][])[0];
      }
      return fn(url, init);
    });
    globalThis.fetch = fnWithCapture as unknown as typeof fetch;
    const { run } = await import('./logBackupManifest.js');

    await run({
      GOOGLE_SERVICE_ACCOUNT_JSON: testKeyJson(),
      GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-123',
      BACKUP_STATUS: 'failure',
      BACKUP_ERROR_SUMMARY: 'pg_dump exited non-zero',
    } as unknown as NodeJS.ProcessEnv);

    expect(appendedRow?.[3]).toBe('failure');
    expect(appendedRow?.[8]).toBe('pg_dump exited non-zero');
  });

  it('skips appending a duplicate row for a run/attempt already logged (idempotent retry)', async () => {
    const { fn } = makeFetchRouter([
      ...BASE_ROUTES,
      { match: (url: string) => url.includes('/values/Backup%20Log!A1%3AI1'), respond: () => ({ values: [['timestamp_utc']] }) },
      { match: (url: string) => url.includes('/values/Backup%20Log!A2%3AC'), respond: () => ({ values: [['t', '42', '1']] }) }, // already logged
      { match: (url: string) => url.includes(':append'), respond: () => ({}) },
    ]);
    globalThis.fetch = fn as unknown as typeof fetch;
    const { run } = await import('./logBackupManifest.js');

    await run({
      GOOGLE_SERVICE_ACCOUNT_JSON: testKeyJson(),
      GOOGLE_SHEETS_SPREADSHEET_ID: 'sheet-123',
      BACKUP_STATUS: 'success',
      GITHUB_RUN_ID: '42',
      GITHUB_RUN_ATTEMPT: '1',
    } as unknown as NodeJS.ProcessEnv);

    const appendCall = fn.mock.calls.find(([url]) => url.includes(':append'));
    expect(appendCall).toBeUndefined();
  });
});
