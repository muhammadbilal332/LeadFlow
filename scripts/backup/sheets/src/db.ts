/**
 * Read-only, paginated access to the configured business tables, all
 * within one REPEATABLE READ (read-only) transaction — every table is
 * read from the same consistent point-in-time snapshot, so the export
 * can't end up internally inconsistent from concurrent application writes
 * happening mid-export.
 */
import pg from 'pg';
import type { BusinessTableConfig } from './businessDataConfig.js';

const PAGE_SIZE = 1000;

export class BusinessDataReader {
  private client: pg.PoolClient | null = null;

  constructor(private readonly pool: pg.Pool) {}

  async begin(): Promise<void> {
    this.client = await this.pool.connect();
    await this.client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  }

  async end(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.query('COMMIT');
    } finally {
      this.client.release();
      this.client = null;
    }
  }

  async countRows(table: string): Promise<number> {
    if (!this.client) throw new Error('BusinessDataReader.begin() must be called first');
    // Table names come only from businessDataConfig.ts (a fixed, trusted
    // allowlist), never from external input, so this is not injectable.
    const res = await this.client.query<{ count: string }>(`SELECT count(*)::text AS count FROM public.${table}`);
    return Number(res.rows[0]?.count ?? 0);
  }

  /** Fetches all rows for one configured table, paginated, never loading more than PAGE_SIZE rows into memory at a time. */
  async *readRows(config: BusinessTableConfig): AsyncGenerator<unknown[][], void, void> {
    if (!this.client) throw new Error('BusinessDataReader.begin() must be called first');
    const columnList = config.columns.map((c) => `"${c}"`).join(', ');
    let offset = 0;
    for (;;) {
      const res = await this.client.query(`SELECT ${columnList} FROM public.${config.table} ORDER BY ${config.orderBy} LIMIT $1 OFFSET $2`, [PAGE_SIZE, offset]);
      if (res.rows.length === 0) return;
      yield res.rows.map((row) => config.columns.map((c) => row[c]));
      if (res.rows.length < PAGE_SIZE) return;
      offset += PAGE_SIZE;
    }
  }
}
