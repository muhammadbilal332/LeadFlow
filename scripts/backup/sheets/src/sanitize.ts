/**
 * Cell-value sanitization shared by every writer. Two independent concerns:
 * formula-injection neutralization (security) and consistent null/timestamp
 * formatting (readability) — both must happen before a value ever reaches
 * the Sheets API.
 */

const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@'];

/**
 * Google Sheets treats a cell starting with =, +, -, or @ as a formula
 * (CSV-injection's spreadsheet cousin). A leading apostrophe forces Sheets
 * to render the rest of the string as literal text, exactly like typing it
 * manually in the UI — never executed, always keeps the original content
 * byte-for-byte after that first character.
 */
export function neutralizeFormulaInjection(value: string): string {
  if (value.length > 0 && FORMULA_TRIGGER_CHARS.includes(value[0])) {
    return `'${value}`;
  }
  return value;
}

/** Converts an arbitrary DB value into the string a Sheets cell should hold. Null/undefined -> empty string, never the literal word "null". */
export function cellValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (typeof value === 'object') {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }
  return neutralizeFormulaInjection(str);
}

/** Applies cellValue to every value in a row, in the caller-supplied column order (deterministic — never relies on object key iteration order). */
export function sanitizeRow(row: unknown[]): string[] {
  return row.map(cellValue);
}
