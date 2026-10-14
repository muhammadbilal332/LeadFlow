import { describe, it, expect } from 'vitest';
import { checkRowLimit, checkColumnLimit, chunk, SAFE_ROWS_PER_TABLE, SHEETS_MAX_COLUMNS_PER_SHEET } from './limits.js';

describe('checkRowLimit', () => {
  it('passes under the safety limit', () => {
    expect(checkRowLimit('Leads', 100).ok).toBe(true);
  });

  it('fails over the safety limit, with a reason pointing to the R2 backup as the alternative', () => {
    const result = checkRowLimit('Leads', SAFE_ROWS_PER_TABLE + 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/R2/);
  });
});

describe('checkColumnLimit', () => {
  it('passes under the Sheets hard limit', () => {
    expect(checkColumnLimit('Leads', 15).ok).toBe(true);
  });

  it('fails over the Sheets hard limit', () => {
    expect(checkColumnLimit('Leads', SHEETS_MAX_COLUMNS_PER_SHEET + 1).ok).toBe(false);
  });
});

describe('chunk', () => {
  it('splits evenly', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });

  it('handles a remainder', () => {
    expect(chunk([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });

  it('handles an empty array', () => {
    expect(chunk([], 2)).toEqual([]);
  });
});
