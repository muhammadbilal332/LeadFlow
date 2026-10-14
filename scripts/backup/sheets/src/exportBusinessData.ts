/**
 * Exports the approved business-data allowlist (businessDataConfig.ts) to
 * Google Sheets as a readable "current snapshot" per tab — each run
 * overwrites that tab's data rows with a fresh, consistent read, rather
 * than accumulating forever (unlike Backup Log / Export Runs, which are
 * append-only history). One row is appended to "Export Runs" summarizing
 * every run, success or failure.
 *
 * Read-only against the database: every query is a plain SELECT inside a
 * single REPEATABLE READ READ ONLY transaction, never a write.
 */
import pg from 'pg';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseServiceAccountJson, getAccessToken } from './googleAuth.js';
import { SheetsClient, type SheetInfo } from './sheetsClient.js';
import { sanitizeRow } from './sanitize.js';
import { BusinessDataReader } from './db.js';
import { a1Range } from './a1.js';
import { checkRowLimit, checkColumnLimit, chunk, WRITE_BATCH_SIZE } from './limits.js';
import { BUSINESS_TABLES, EXPORT_RUNS_SHEET, EXPORT_RUNS_HEADER } from './businessDataConfig.js';

function requireEnv(env: NodeJS.ProcessEnv, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = env[name];
    if (!value) missing.push(name);
    else out[name] = value;
  }
  if (missing.length > 0) throw new Error(`missing required environment variable(s): ${missing.join(', ')}`);
  return out;
}

async function exportOneTable(client: SheetsClient, sheets: SheetInfo[], reader: BusinessDataReader, config: (typeof BUSINESS_TABLES)[number]): Promise<{ rows: number; skipped?: string }> {
  const colCheck = checkColumnLimit(config.sheetTitle, config.columns.length);
  if (!colCheck.ok) return { rows: 0, skipped: colCheck.reason };

  const total = await reader.countRows(config.table);
  const rowCheck = checkRowLimit(config.sheetTitle, total);
  if (!rowCheck.ok) {
    console.warn(rowCheck.reason);
    return { rows: 0, skipped: rowCheck.reason };
  }

  await client.ensureSheetExists(config.sheetTitle);
  const sheetInfo = sheets.find((s) => s.title === config.sheetTitle) ?? (await client.getSheets()).find((s) => s.title === config.sheetTitle);
  if (!sheetInfo) throw new Error(`could not resolve sheet metadata for ${config.sheetTitle} after ensuring it exists`);

  const neededRows = total + 1; // +1 header
  await client.ensureCapacity(sheetInfo.sheetId, config.sheetTitle, neededRows, config.columns.length);

  // Overwrite the whole data region (header + however many rows existed
  // before, whichever is larger) so a shrinking table doesn't leave stale
  // rows behind from a previous, larger snapshot.
  const existing = await client.getValues(`${config.sheetTitle}!A1:A`);
  const previousRowCount = Math.max(existing.length, 1);
  if (previousRowCount > 1) {
    await client.clearRange(a1Range(config.sheetTitle, 1, config.columns.length, previousRowCount));
  }

  await client.updateRange(a1Range(config.sheetTitle, 1, config.columns.length, 1), [sanitizeRow(config.columns)]);

  let written = 0;
  let rowCursor = 2; // row 1 is the header
  for await (const page of reader.readRows(config)) {
    for (const batch of chunk(page, WRITE_BATCH_SIZE)) {
      const sanitized = batch.map((row) => sanitizeRow(row));
      await client.updateRange(a1Range(config.sheetTitle, rowCursor, config.columns.length, sanitized.length), sanitized);
      rowCursor += sanitized.length;
      written += sanitized.length;
    }
  }
  return { rows: written };
}

export async function run(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const startedAt = Date.now();
  const required = requireEnv(env, ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SHEETS_SPREADSHEET_ID', 'SUPABASE_DB_URL']);
  const runId = env.GITHUB_RUN_ID ?? 'local';
  const runAttempt = env.GITHUB_RUN_ATTEMPT ?? 'local';
  const trigger = env.GITHUB_EVENT_NAME ?? 'manual';

  const key = parseServiceAccountJson(required.GOOGLE_SERVICE_ACCOUNT_JSON);
  const accessToken = await getAccessToken(key);
  const client = new SheetsClient(required.GOOGLE_SHEETS_SPREADSHEET_ID, accessToken);

  await client.ensureSheetExists(EXPORT_RUNS_SHEET);
  const existingRunsHeader = await client.getValues(`${EXPORT_RUNS_SHEET}!A1:I1`);
  if (existingRunsHeader.length === 0) {
    await client.updateRange(`${EXPORT_RUNS_SHEET}!A1:I1`, [EXPORT_RUNS_HEADER]);
  }
  const existingRuns = await client.getValues(`${EXPORT_RUNS_SHEET}!A2:C`);
  if (existingRuns.some((row) => row[1] === runId && row[2] === runAttempt)) {
    console.log(`Export Runs already has a row for run ${runId} attempt ${runAttempt} — skipping duplicate run.`);
    return;
  }

  const useSsl = /supabase\.co|sslmode=require/i.test(required.SUPABASE_DB_URL);
  const pool = new pg.Pool({ connectionString: required.SUPABASE_DB_URL, ssl: useSsl ? { rejectUnauthorized: false } : undefined, max: 1 });
  const reader = new BusinessDataReader(pool);

  let status = 'success';
  let errorSummary = '';
  const exportedTables: string[] = [];
  let totalRows = 0;

  try {
    await reader.begin();
    const sheets = await client.getSheets();
    for (const config of BUSINESS_TABLES) {
      const result = await exportOneTable(client, sheets, reader, config);
      if (result.skipped) {
        exportedTables.push(`${config.sheetTitle} (skipped: see logs)`);
      } else {
        exportedTables.push(`${config.sheetTitle} (${result.rows})`);
        totalRows += result.rows;
      }
    }
    await reader.end();
  } catch (err) {
    status = 'failure';
    errorSummary = err instanceof Error ? err.message : String(err);
    try {
      await reader.end();
    } catch {
      // Best-effort — the real error is already captured above.
    }
  } finally {
    await pool.end();
  }

  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  const row = sanitizeRow([new Date().toISOString(), runId, runAttempt, trigger, status, exportedTables.join('; '), totalRows, durationSeconds, errorSummary]);
  await client.appendRows(`${EXPORT_RUNS_SHEET}!A:I`, [row]);

  console.log(`Business data export ${status}. Tables: ${exportedTables.join(', ')}. Total rows: ${totalRows}. Duration: ${durationSeconds}s.`);
  if (status === 'failure') {
    throw new Error(errorSummary);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  run().catch((err) => {
    console.error('exportBusinessData failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
