/**
 * Appends one row to the "Backup Log" tab recording a single backup
 * attempt (success or failure). Called as an independent workflow step
 * AFTER the R2 backup step, with `if: always()` — so it runs whether the
 * backup succeeded or failed, and its own failure must never be read as
 * the R2 backup's result (that decoupling lives in the workflow YAML, via
 * `continue-on-error` + a separate step that re-asserts the job's real
 * outcome from the backup step alone).
 *
 * Required env vars: GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_SHEETS_SPREADSHEET_ID,
 * BACKUP_STATUS. Everything else is optional (a very early failure, e.g.
 * missing R2 secrets, may not have a timestamp/object key yet at all).
 * Never prints the service-account key or any secret value.
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parseServiceAccountJson, getAccessToken } from './googleAuth.js';
import { SheetsClient } from './sheetsClient.js';
import { sanitizeRow } from './sanitize.js';
import { BACKUP_LOG_SHEET, BACKUP_LOG_HEADER } from './businessDataConfig.js';

function requireEnv(env: NodeJS.ProcessEnv, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = env[name];
    if (!value) missing.push(name);
    else out[name] = value;
  }
  if (missing.length > 0) {
    throw new Error(`missing required environment variable(s): ${missing.join(', ')}`);
  }
  return out;
}

export async function run(env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const required = requireEnv(env, ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SHEETS_SPREADSHEET_ID', 'BACKUP_STATUS']);
  const key = parseServiceAccountJson(required.GOOGLE_SERVICE_ACCOUNT_JSON);
  const accessToken = await getAccessToken(key);
  const client = new SheetsClient(required.GOOGLE_SHEETS_SPREADSHEET_ID, accessToken);

  await client.ensureSheetExists(BACKUP_LOG_SHEET);
  const existing = await client.getValues(`${BACKUP_LOG_SHEET}!A1:I1`);
  if (existing.length === 0) {
    await client.updateRange(`${BACKUP_LOG_SHEET}!A1:I1`, [BACKUP_LOG_HEADER]);
  }

  const runId = env.GITHUB_RUN_ID ?? 'local';
  const runAttempt = env.GITHUB_RUN_ATTEMPT ?? 'local';

  // Idempotency: if this exact run+attempt was already logged (a retried
  // workflow step re-invoking this script), don't append a second row.
  const existingRows = await client.getValues(`${BACKUP_LOG_SHEET}!A2:C`);
  const alreadyLogged = existingRows.some((row) => row[1] === runId && row[2] === runAttempt);
  if (alreadyLogged) {
    console.log(`Backup Log already has a row for run ${runId} attempt ${runAttempt} — skipping duplicate append.`);
    return;
  }

  const row = sanitizeRow([
    env.BACKUP_TIMESTAMP ?? '',
    runId,
    runAttempt,
    required.BACKUP_STATUS,
    env.BACKUP_OBJECT_KEY ?? '',
    env.BACKUP_SIZE_BYTES ?? '',
    env.BACKUP_SHA256 ?? '',
    env.BACKUP_DURATION_SECONDS ?? '',
    env.BACKUP_ERROR_SUMMARY ?? '',
  ]);
  await client.appendRows(`${BACKUP_LOG_SHEET}!A:I`, [row]);
  console.log(`Logged backup manifest row: status=${required.BACKUP_STATUS} run=${runId}/${runAttempt}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  run().catch((err) => {
    console.error('logBackupManifest failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
