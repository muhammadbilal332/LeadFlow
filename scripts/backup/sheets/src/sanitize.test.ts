import { describe, it, expect } from 'vitest';
import { neutralizeFormulaInjection, cellValue, sanitizeRow } from './sanitize.js';

describe('neutralizeFormulaInjection', () => {
  it.each(['=', '+', '-', '@'])('prefixes a value starting with %s with a leading apostrophe', (trigger) => {
    const input = `${trigger}SUM(A1:A10)`;
    const out = neutralizeFormulaInjection(input);
    expect(out).toBe(`'${input}`);
    expect(out.startsWith("'")).toBe(true);
  });

  it('leaves an ordinary value untouched', () => {
    expect(neutralizeFormulaInjection('Acme Corp')).toBe('Acme Corp');
  });

  it('leaves an empty string untouched', () => {
    expect(neutralizeFormulaInjection('')).toBe('');
  });
});

describe('cellValue', () => {
  it('converts null and undefined to empty string, never the word "null"', () => {
    expect(cellValue(null)).toBe('');
    expect(cellValue(undefined)).toBe('');
  });

  it('formats a Date as ISO 8601', () => {
    const d = new Date('2026-10-14T12:00:00.000Z');
    expect(cellValue(d)).toBe('2026-10-14T12:00:00.000Z');
  });

  it('stringifies a plain object as JSON', () => {
    expect(cellValue({ a: 1 })).toBe('{"a":1}');
  });

  it('stringifies a number', () => {
    expect(cellValue(42)).toBe('42');
  });

  it('neutralizes formula-injection in a string value', () => {
    expect(cellValue('=1+1')).toBe("'=1+1");
  });
});

describe('sanitizeRow', () => {
  it('applies cellValue to every element in order', () => {
    expect(sanitizeRow(['a', null, 1, '=HACK()'])).toEqual(['a', '', '1', "'=HACK()"]);
  });
});
