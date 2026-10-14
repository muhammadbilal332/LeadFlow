import { describe, it, expect } from 'vitest';
import { BUSINESS_TABLES } from './businessDataConfig.js';

// Columns confirmed sensitive by the repository audit (password hashes,
// encrypted tokens, secret hashes, and unbounded free-text fields that
// could contain arbitrary customer/business detail). None of these must
// ever appear in the approved export allowlist, no matter which table
// they're checked against.
const FORBIDDEN_COLUMNS = ['password_hash', 'key_hash', 'secret_hash', 'secret_prefix', 'access_token_encrypted', 'notes', 'description', 'pain_points', 'possible_solution', 'custom_context'];

describe('BUSINESS_TABLES allowlist', () => {
  it('only lists the three approved tables', () => {
    const tables = BUSINESS_TABLES.map((t) => t.table).sort();
    expect(tables).toEqual(['leads', 'outreach_contacts', 'quotations']);
  });

  for (const config of BUSINESS_TABLES) {
    it(`${config.table} excludes every forbidden/sensitive column`, () => {
      for (const forbidden of FORBIDDEN_COLUMNS) {
        expect(config.columns).not.toContain(forbidden);
      }
    });

    it(`${config.table} has a non-empty, deterministic column order`, () => {
      expect(config.columns.length).toBeGreaterThan(0);
      expect(new Set(config.columns).size).toBe(config.columns.length); // no duplicate columns
    });

    it(`${config.table} includes business_id for tenant traceability`, () => {
      expect(config.columns).toContain('business_id');
    });
  }

  it('never includes a users table (authentication/permissions, not business data)', () => {
    expect(BUSINESS_TABLES.some((t) => t.table === 'users')).toBe(false);
  });

  it('never includes tables that hold actual email/outreach content', () => {
    const contentTables = ['outreach_messages', 'outreach_drafts', 'email_replies', 'email_threads'];
    for (const t of contentTables) {
      expect(BUSINESS_TABLES.some((bt) => bt.table === t)).toBe(false);
    }
  });
});
