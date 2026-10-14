import { describe, it, expect } from 'vitest';
import { columnLetter, a1Range } from './a1.js';

describe('columnLetter', () => {
  it('converts single letters', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(26)).toBe('Z');
  });

  it('converts double letters past Z', () => {
    expect(columnLetter(27)).toBe('AA');
    expect(columnLetter(52)).toBe('AZ');
  });
});

describe('a1Range', () => {
  it('builds a range starting at row 1', () => {
    expect(a1Range('Leads', 1, 15, 1)).toBe('Leads!A1:O1');
  });

  it('builds a range for a data block starting after the header', () => {
    expect(a1Range('Leads', 2, 3, 500)).toBe('Leads!A2:C501');
  });
});
