/**
 * Google Sheets' documented hard limits, plus a conservative safety margin
 * this toolkit enforces well before hitting them. Hitting the real ceiling
 * means Google starts rejecting writes outright; the point of checking
 * early is to fail with a clear, actionable message instead of a confusing
 * partial write.
 */

/** Google's documented per-spreadsheet cell ceiling. */
export const SHEETS_MAX_CELLS_PER_SPREADSHEET = 10_000_000;
/** Google's documented per-sheet column ceiling. */
export const SHEETS_MAX_COLUMNS_PER_SHEET = 18_278;

/**
 * This toolkit's own safety ceiling for one business-data tab — well under
 * Google's real limits, chosen because a sheet past this size stops being
 * a usable "readable export for historical inspection" (the stated
 * purpose) and should go through the full R2 dump instead.
 */
export const SAFE_ROWS_PER_TABLE = 20_000;

/** Rows per single API write — keeps each request body comfortably small regardless of column count. */
export const WRITE_BATCH_SIZE = 500;

export interface LimitCheckResult {
  ok: boolean;
  reason?: string;
}

/** Checked before writing any table — never after a partial write has already happened. */
export function checkRowLimit(tableName: string, rowCount: number): LimitCheckResult {
  if (rowCount > SAFE_ROWS_PER_TABLE) {
    return {
      ok: false,
      reason: `${tableName} has ${rowCount} rows, over this toolkit's safety limit of ${SAFE_ROWS_PER_TABLE}. Skipping this table's Sheets export — restore from the Cloudflare R2 backup for complete data instead (see docs/DATABASE_BACKUP_AND_RESTORE.md).`,
    };
  }
  return { ok: true };
}

export function checkColumnLimit(tableName: string, columnCount: number): LimitCheckResult {
  if (columnCount > SHEETS_MAX_COLUMNS_PER_SHEET) {
    return { ok: false, reason: `${tableName} has ${columnCount} columns, over Google Sheets' hard limit of ${SHEETS_MAX_COLUMNS_PER_SHEET}.` };
  }
  return { ok: true };
}

/** Splits rows into fixed-size chunks for batched writes. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}
