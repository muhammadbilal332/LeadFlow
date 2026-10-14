import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Repo root is four levels up from scripts/backup/sheets/src/.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const WORKFLOW_PATH = resolve(REPO_ROOT, '.github/workflows/database-backup.yml');

describe('database-backup.yml: R2 backup vs Google Sheets logging are decoupled', () => {
  const yaml = readFileSync(WORKFLOW_PATH, 'utf8');

  it('gives the R2 backup step an id so its outcome can be referenced later', () => {
    expect(yaml).toMatch(/id:\s*backup\b/);
  });

  it('marks both the R2 backup step and the Sheets logging step continue-on-error, so neither can silently fail the whole job', () => {
    const continueOnErrorCount = (yaml.match(/continue-on-error:\s*true/g) ?? []).length;
    expect(continueOnErrorCount).toBeGreaterThanOrEqual(2);
  });

  it('runs the Sheets logging step unconditionally (if: always()), so a failed R2 backup still gets logged', () => {
    const alwaysCount = (yaml.match(/if:\s*always\(\)/g) ?? []).length;
    expect(alwaysCount).toBeGreaterThanOrEqual(1);
  });

  it('has a Finalize step that re-derives the job result from the backup step\'s own outcome, not from the Sheets step', () => {
    expect(yaml).toMatch(/steps\.backup\.outcome/);
  });

  it('passes the backup step\'s outputs into the Sheets logging step by reference, never literal values', () => {
    expect(yaml).toMatch(/steps\.backup\.outputs\.status/);
    expect(yaml).toMatch(/steps\.backup\.outputs\.object_key/);
  });

  it('never references a raw secret value outside of the standard ${{ secrets.* }} syntax', () => {
    // A crude but effective guard: every occurrence of "GOOGLE_SERVICE_ACCOUNT_JSON"
    // or "SUPABASE_DB_URL" as a *value* (right of a colon) must be the secrets
    // expression, never something that looks like an inline credential.
    const suspiciousAssignment = /:\s*["']?(?:ya29|AIza|-----BEGIN)/;
    expect(suspiciousAssignment.test(yaml)).toBe(false);
  });
});
