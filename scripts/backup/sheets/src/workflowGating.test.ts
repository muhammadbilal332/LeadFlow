/**
 * Guards the workflow YAML's own gating logic — not the scheduleGate.ts
 * function tested elsewhere, but the `if:` wiring around it. These are
 * plain string checks (no new YAML-parsing dependency) because the
 * properties that matter are simple to state as substrings: the R2 backup
 * step must never reference the schedule gate at all, and every Sheets
 * step gated by it must also let a manual workflow_dispatch run bypass it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '../../../..');
const databaseBackupYml = readFileSync(resolve(repoRoot, '.github/workflows/database-backup.yml'), 'utf8');
const businessDataExportYml = readFileSync(resolve(repoRoot, '.github/workflows/business-data-export.yml'), 'utf8');

describe('database-backup.yml schedule gating', () => {
  it('runs on the unchanged every-15-minutes cron', () => {
    expect(databaseBackupYml).toMatch(/cron:\s*'\*\/15 \* \* \* \*'/);
  });

  it('the "Run backup" (R2) step never references the schedule gate', () => {
    const match = databaseBackupYml.match(/- name: Run backup[\s\S]*?(?=\n {6}- name:|\n*$)/);
    expect(match).not.toBeNull();
    expect(match![0]).not.toMatch(/schedule_gate/);
  });

  it('the Sheets log step is gated by the schedule, with a manual-dispatch bypass', () => {
    const match = databaseBackupYml.match(/- name: Log backup manifest to Google Sheets[\s\S]*?run:/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/steps\.schedule_gate\.outputs\.in_window == 'true'/);
    expect(match![0]).toMatch(/github\.event_name == 'workflow_dispatch'/);
  });

  it('the schedule gate step itself never fails the job (continue-on-error)', () => {
    const match = databaseBackupYml.match(/- name: Check Sheets working-window schedule[\s\S]*?run:/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/continue-on-error: true/);
  });
});

describe('business-data-export.yml schedule gating', () => {
  it('fires every 15 minutes (gated by the working window, not a fixed daily time)', () => {
    expect(businessDataExportYml).toMatch(/cron:\s*'\*\/15 \* \* \* \*'/);
  });

  it('the export step is gated by the schedule, with a manual-dispatch bypass', () => {
    const match = businessDataExportYml.match(/- name: Export business data to Google Sheets[\s\S]*?run:/);
    expect(match).not.toBeNull();
    expect(match![0]).toMatch(/steps\.schedule_gate\.outputs\.in_window == 'true'/);
    expect(match![0]).toMatch(/github\.event_name == 'workflow_dispatch'/);
  });
});
