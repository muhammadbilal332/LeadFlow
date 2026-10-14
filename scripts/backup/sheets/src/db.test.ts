import { describe, it, expect, vi } from 'vitest';
import { BusinessDataReader } from './db.js';
import type { BusinessTableConfig } from './businessDataConfig.js';

const config: BusinessTableConfig = {
  sheetTitle: 'Leads',
  table: 'leads',
  columns: ['id', 'name'],
  orderBy: 'created_at ASC',
};

function makeFakeRow(i: number) {
  return { id: `id-${i}`, name: `Lead ${i}` };
}

/** A fake pg.Pool/Client — no real database connection anywhere in this test. */
function makeFakePool(totalRows: number) {
  const queries: string[] = [];
  const client = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      queries.push(sql);
      if (sql.startsWith('BEGIN') || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('count(*)')) return { rows: [{ count: String(totalRows) }] };
      const [limit, offset] = params as [number, number];
      const rows = [];
      for (let i = offset; i < Math.min(offset + limit, totalRows); i++) rows.push(makeFakeRow(i));
      return { rows };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => {}) };
  return { pool, client, queries };
}

describe('BusinessDataReader pagination', () => {
  it('never requests more than PAGE_SIZE (1000) rows in a single query', async () => {
    const { pool, client } = makeFakePool(2500);
    const reader = new BusinessDataReader(pool as unknown as import('pg').Pool);
    await reader.begin();
    const pages: unknown[][][] = [];
    for await (const page of reader.readRows(config)) pages.push(page);
    await reader.end();

    const selectCalls = client.query.mock.calls.filter(([sql]) => sql.includes('SELECT'));
    for (const [, params] of selectCalls) {
      expect((params as number[])[0]).toBeLessThanOrEqual(1000);
    }
    expect(pages.flat()).toHaveLength(2500);
  });

  it('issues increasing OFFSET values across pages, never re-reading the same page', async () => {
    const { pool, client } = makeFakePool(2500);
    const reader = new BusinessDataReader(pool as unknown as import('pg').Pool);
    await reader.begin();
    for await (const _page of reader.readRows(config)) {
      // drain
    }
    await reader.end();
    const offsets = client.query.mock.calls.filter(([sql]) => sql.includes('SELECT')).map(([, params]) => params?.[1]);
    expect(offsets).toEqual([0, 1000, 2000]);
  });

  it('stops after a short final page without an extra empty request', async () => {
    const { pool, client } = makeFakePool(50);
    const reader = new BusinessDataReader(pool as unknown as import('pg').Pool);
    await reader.begin();
    let total = 0;
    for await (const page of reader.readRows(config)) total += page.length;
    await reader.end();
    expect(total).toBe(50);
    const selectCalls = client.query.mock.calls.filter(([sql]) => sql.includes('SELECT'));
    expect(selectCalls).toHaveLength(1);
  });

  it('runs the whole read inside BEGIN...COMMIT for a consistent snapshot', async () => {
    const { pool, client } = makeFakePool(10);
    const reader = new BusinessDataReader(pool as unknown as import('pg').Pool);
    await reader.begin();
    for await (const _p of reader.readRows(config)) {
      // drain
    }
    await reader.end();
    const sqlCalls = client.query.mock.calls.map(([sql]) => sql);
    expect(sqlCalls[0]).toMatch(/BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY/);
    expect(sqlCalls[sqlCalls.length - 1]).toBe('COMMIT');
  });

  it('uses only the configured columns, never SELECT *', async () => {
    const { pool, client } = makeFakePool(5);
    const reader = new BusinessDataReader(pool as unknown as import('pg').Pool);
    await reader.begin();
    for await (const _p of reader.readRows(config)) {
      // drain
    }
    await reader.end();
    const selectCall = client.query.mock.calls.find(([sql]) => sql.includes('SELECT'));
    expect(selectCall).toBeDefined();
    expect(selectCall![0]).not.toContain('*');
    expect(selectCall![0]).toContain('"id"');
    expect(selectCall![0]).toContain('"name"');
  });
});
