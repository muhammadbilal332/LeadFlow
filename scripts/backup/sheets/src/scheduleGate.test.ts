import { describe, it, expect } from 'vitest';
import { parseScheduleConfig, isWithinWorkingWindow, run } from './scheduleGate.js';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('parseScheduleConfig', () => {
  it('applies documented defaults when nothing is configured', () => {
    const config = parseScheduleConfig({});
    expect(config.timezone).toBe('UTC');
    expect([...config.workingDays].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(config.startHour).toBe(9);
    expect(config.workingHours).toBe(9);
  });

  it('rejects an unrecognized timezone name', () => {
    expect(() => parseScheduleConfig({ SHEETS_SCHEDULE_TIMEZONE: 'Not/ARealZone' })).toThrow(/not a recognized IANA timezone/);
  });

  it('rejects an out-of-range working day', () => {
    expect(() => parseScheduleConfig({ SHEETS_SCHEDULE_WORKING_DAYS: '1,8' })).toThrow(/must be an integer 1-7/);
  });

  it('rejects an empty working-days list', () => {
    expect(() => parseScheduleConfig({ SHEETS_SCHEDULE_WORKING_DAYS: '' })).not.toThrow(); // empty string falls back to default
    expect(() => parseScheduleConfig({ SHEETS_SCHEDULE_WORKING_DAYS: ',,' })).toThrow(/at least one working day/);
  });

  it('rejects an out-of-range start hour', () => {
    expect(() => parseScheduleConfig({ SHEETS_SCHEDULE_START_HOUR: '24' })).toThrow(/must be an integer 0-23/);
  });

  it('rejects a window that crosses midnight', () => {
    expect(() => parseScheduleConfig({ SHEETS_SCHEDULE_START_HOUR: '20', SHEETS_SCHEDULE_WORKING_HOURS: '9' })).toThrow(/crosses midnight/);
  });
});

describe('isWithinWorkingWindow', () => {
  it('is true for a weekday mid-morning within the default window (UTC)', () => {
    // 2026-10-13 is a Tuesday
    const config = parseScheduleConfig({});
    const decision = isWithinWorkingWindow(new Date('2026-10-13T10:00:00Z'), config);
    expect(decision.inWindow).toBe(true);
  });

  it('is false on a non-working day (Sunday, default config excludes it)', () => {
    // 2026-10-11 is a Sunday
    const config = parseScheduleConfig({});
    const decision = isWithinWorkingWindow(new Date('2026-10-11T10:00:00Z'), config);
    expect(decision.inWindow).toBe(false);
    expect(decision.reason).toMatch(/not a configured working day/);
  });

  it('is false before the configured start hour', () => {
    const config = parseScheduleConfig({});
    const decision = isWithinWorkingWindow(new Date('2026-10-13T08:59:00Z'), config);
    expect(decision.inWindow).toBe(false);
    expect(decision.reason).toMatch(/outside the working window/);
  });

  it('is true at the exact start minute and false at the exact end minute (half-open window)', () => {
    const config = parseScheduleConfig({});
    expect(isWithinWorkingWindow(new Date('2026-10-13T09:00:00Z'), config).inWindow).toBe(true);
    expect(isWithinWorkingWindow(new Date('2026-10-13T18:00:00Z'), config).inWindow).toBe(false);
  });

  it('honors a custom timezone, working-day set, and window', () => {
    const config = parseScheduleConfig({
      SHEETS_SCHEDULE_TIMEZONE: 'America/New_York',
      SHEETS_SCHEDULE_WORKING_DAYS: '1,2,3,4,5', // Mon-Fri only
      SHEETS_SCHEDULE_START_HOUR: '9',
      SHEETS_SCHEDULE_WORKING_HOURS: '8',
    });
    // 2026-10-13 14:30 UTC = 10:30 EDT (within 09:00-17:00 window, Tuesday)
    expect(isWithinWorkingWindow(new Date('2026-10-13T14:30:00Z'), config).inWindow).toBe(true);
    // Same UTC instant on a Saturday is excluded by the Mon-Fri working-day set
    expect(isWithinWorkingWindow(new Date('2026-10-17T14:30:00Z'), config).inWindow).toBe(false);
  });

  it('correctly follows a DST transition in the configured timezone without special-case code', () => {
    const config = parseScheduleConfig({ SHEETS_SCHEDULE_TIMEZONE: 'America/New_York', SHEETS_SCHEDULE_START_HOUR: '9', SHEETS_SCHEDULE_WORKING_HOURS: '9' });
    // US DST started 2026-03-08. Before the transition, 13:30 UTC = 08:30 EST (outside window).
    expect(isWithinWorkingWindow(new Date('2026-03-07T13:30:00Z'), config).inWindow).toBe(false);
    // After the transition, the same 13:30 UTC = 09:30 EDT (inside window) — proves the gate
    // re-derives the UTC offset from the IANA database rather than using a fixed offset.
    expect(isWithinWorkingWindow(new Date('2026-03-09T13:30:00Z'), config).inWindow).toBe(true);
  });
});

describe('run (CLI entry point)', () => {
  it('writes in_window=true/false to GITHUB_OUTPUT and returns the decision', () => {
    const dir = mkdtempSync(join(tmpdir(), 'schedule-gate-test-'));
    const outputFile = join(dir, 'github_output');
    const decision = run({ GITHUB_OUTPUT: outputFile } as unknown as NodeJS.ProcessEnv, new Date('2026-10-13T10:00:00Z'));
    expect(decision.inWindow).toBe(true);
    const written = readFileSync(outputFile, 'utf8');
    expect(written).toContain('in_window=true');
  });

  it('throws (and does not write a bogus decision) on invalid config', () => {
    expect(() => run({ SHEETS_SCHEDULE_TIMEZONE: 'Not/ARealZone' } as unknown as NodeJS.ProcessEnv, new Date())).toThrow(/not a recognized IANA timezone/);
  });
});
