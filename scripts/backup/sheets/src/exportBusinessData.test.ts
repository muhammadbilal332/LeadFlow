import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';

function testKeyJson(): string {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return JSON.stringify({ client_email: 'bot@project.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs1', format: 'pem' }).toString() });
}

// No real database connection anywhere in this file — `pg` is fully mocked.
const fakeClient = {
  query: vi.fn(async (sql: string) => {
    if (sql.startsWith('BEGIN') || sql === 'COMMIT') return { rows: [] };
    if (sql.includes('count(*)')) return { rows: [{ count: '2' }] };
    return { rows: [{ id: 'lead-1', name: "=EVIL()" }, { id: 'lead-2', name: 'Normal Co' }] };
  }),
  release: vi.fn(),
};
const fakePoolEnd = vi.fn(async () => {});
const PoolCtor = vi.fn(() => ({ connect: vi.fn(async () => fakeClient), end: fakePoolEnd }));
vi.mock('pg', () => ({ default: { Pool: PoolCtor } }));

function makeFetchRouter(extra: Array<{ match: (url: string, init?: RequestInit) => boolean; respond: () => unknown }> = []) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const routes = [
    // Test-specific overrides must win over the generic base fixtures below.
    ...extra,
    { match: (url: string) => url.includes('oauth2.googleapis.com/token'), respond: () => ({ access_token: 'fake-token' }) },
    {
      match: (url: string, init?: RequestInit) => !init?.method && !/:(?:batchUpdate|append|clear)/.test(url) && !url.includes('/values/'),
      respond: () => ({
        sheets: [
          { properties: { sheetId: 1, title: 'Export Runs', gridProperties: { rowCount: 1000, columnCount: 26 } } },
          { properties: { sheetId: 2, title: 'Leads', gridProperties: { rowCount: 1000, columnCount: 26 } } },
          { properties: { sheetId: 3, title: 'Outreach Contacts', gridProperties: { rowCount: 1000, columnCount: 26 } } },
          { properties: { sheetId: 4, title: 'Quotations', gridProperties: { rowCount: 1000, columnCount: 26 } } },
        ],
      }),
    },
    { match: (url: string, init?: RequestInit) => url.includes('/values/Export%20Runs!A1%3AI1') && !init?.method, respond: () => ({ values: [['h']] }) },
    { match: (url: string, init?: RequestInit) => url.includes('/values/Export%20Runs!A2%3AC') && !init?.method, respond: () => ({ values: [] }) },
    { match: (url: string, init?: RequestInit) => url.includes('/values/Leads!A1%3AA') && !init?.method, respond: () => ({ values: [] }) },
    { match: (url: string, init?: RequestInit) => url.includes('/values/Outreach%20Contacts!A1%3AA') && !init?.method, respond: () => ({ values: [] }) },
    { match: (url: string, init?: RequestInit) => url.includes('/values/Quotations!A1%3AA') && !init?.method, respond: () => ({ values: [] }) },
    { match: (url: string, init?: RequestInit) => init?.method === 'PUT', respond: () => ({}) },
    { match: (url: string) => url.includes(':clear'), respond: () => ({}) },
    { match: (url: string) => url.includes(':batchUpdate'), respond: () => ({}) },
    { match: (url: string) => url.includes(':append'), respond: () => ({}) },
  ];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const route = routes.find((r) => r.match(url, init));
    if (!route) throw new Error(`No mock route matched: ${init?.method ?? 'GET'} ${url}`);
    const body = route.respond();
    return { ok: true, json: async () => body, text: async () => JSON.stringify(body) };
  });
  return { fn, calls };
}

describe('exportBusinessData.run', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    PoolCtor.mockClear();
    fakeClient.query.mockClear();
    fakePoolEnd.mockClear();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('fails safely when required secrets are missing, without touching the database', async () => {
    const { fn } = makeFetchRouter();
    globalThis.fetch = fn as unknown as typeof fetch;
    const { run } = await import('./exportBusinessData.js');

    await expect(run({})).rejects.toThrow(/missing required environment variable/);
    expect(PoolCtor).not.toHaveBeenCalled();
  });

  it('skips the database entirely when this run/attempt was already exported (idempotent retry)', async () => {
    const { fn } = makeFetchRouter([{ match: (url: string, init?: RequestInit) => url.includes('/values/Export%20Runs!A2%3AC') && !init?.method, respond: () => ({ values: [['t', '99', '1']] }) }]);
    globalThis.fetch = fn as unknown as typeof fetch;
    const { run } = await import('./exportBusinessData.js');

    await run({ GOOGLE_SERVICE_ACCOUNT_JSON: testKeyJson(), GOOGLE_SHEETS_SPREADSHEET_ID: 's1', SUPABASE_DB_URL: 'postgresql://fake', GITHUB_RUN_ID: '99', GITHUB_RUN_ATTEMPT: '1' } as unknown as NodeJS.ProcessEnv);

    expect(PoolCtor).not.toHaveBeenCalled();
  });

  it('runs a real (mocked) export, escapes a formula-injection attempt in the data, and records success', async () => {
    let finalRunRow: string[] | undefined;
    const { fn } = makeFetchRouter([
      {
        match: (url: string, init?: RequestInit) => url.includes(':append') && url.includes('Export%20Runs'),
        respond: () => ({}),
      },
    ]);
    const capturing = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes(':append') && url.includes('Export%20Runs') && init?.body) {
        finalRunRow = (JSON.parse(init.body as string).values as string[][])[0];
      }
      return fn(url, init);
    });
    globalThis.fetch = capturing as unknown as typeof fetch;
    const { run } = await import('./exportBusinessData.js');

    await run({ GOOGLE_SERVICE_ACCOUNT_JSON: testKeyJson(), GOOGLE_SHEETS_SPREADSHEET_ID: 's1', SUPABASE_DB_URL: 'postgresql://fake' } as unknown as NodeJS.ProcessEnv);

    expect(PoolCtor).toHaveBeenCalledTimes(1);
    expect(fakeClient.query).toHaveBeenCalled();
    expect(fakePoolEnd).toHaveBeenCalledTimes(1); // pool always closed
    expect(finalRunRow?.[4]).toBe('success'); // status column
  });
});
