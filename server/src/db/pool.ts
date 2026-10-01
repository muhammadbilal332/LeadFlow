import { Pool, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';

function createPool(): Pool {
  const useSsl = /supabase\.co|sslmode=require/i.test(env.DATABASE_URL) || env.NODE_ENV === 'production';
  return new Pool({
    connectionString: env.DATABASE_URL,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
  });
}

let pool: Pool = createPool();

/** Allows tests to swap in an in-memory pg-mem pool. */
export function setPool(newPool: Pool): void {
  pool = newPool;
}

export function getPool(): Pool {
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as any[]);
}

export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
