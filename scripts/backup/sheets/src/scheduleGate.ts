/**
 * Decides whether "now" falls inside the configured Google Sheets working
 * window, purely from env config + the system's IANA timezone database
 * (Node's built-in Intl — no extra dependency, DST-aware automatically).
 *
 * This does NOT decide whether a workflow run happens at all — GitHub
 * Actions' cron still fires every 15 minutes, same as the R2 backup. This
 * gate only decides whether that run's Sheets step (log-manifest or
 * export-business-data) should actually write, so a scheduled run outside
 * the configured working hours is a normal, successful no-op rather than a
 * skipped trigger. A manual workflow_dispatch run bypasses this gate
 * entirely (see the `if:` conditions in the workflow YAML, not here) —
 * deliberately kept out of this module so the gate stays a pure function of
 * time + config, independent of how the run was triggered.
 *
 * A window that crosses midnight in the configured timezone is rejected as
 * a config error rather than silently handled — pick a start hour and
 * duration that stay within one calendar day.
 */
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export interface ScheduleConfig {
  timezone: string;
  /** ISO weekday numbers, 1 = Monday .. 7 = Sunday. */
  workingDays: Set<number>;
  /** 0-23, local to `timezone`. */
  startHour: number;
  /** 1-24 hours. */
  workingHours: number;
}

export interface ScheduleDecision {
  inWindow: boolean;
  reason: string;
}

const WEEKDAY_TO_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_WORKING_DAYS = '1,2,3,4,5,6'; // Monday - Saturday (6 days/week)
const DEFAULT_START_HOUR = '9';
const DEFAULT_WORKING_HOURS = '9';

export function parseScheduleConfig(env: NodeJS.ProcessEnv): ScheduleConfig {
  const timezone = env.SHEETS_SCHEDULE_TIMEZONE || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
  } catch {
    throw new Error(`invalid SHEETS_SCHEDULE_TIMEZONE: "${timezone}" is not a recognized IANA timezone name`);
  }

  const workingDaysRaw = env.SHEETS_SCHEDULE_WORKING_DAYS || DEFAULT_WORKING_DAYS;
  const workingDays = new Set<number>();
  for (const part of workingDaysRaw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const day = Number(part);
    if (!Number.isInteger(day) || day < 1 || day > 7) {
      throw new Error(`invalid SHEETS_SCHEDULE_WORKING_DAYS entry "${part}" — must be an integer 1-7 (1=Monday .. 7=Sunday)`);
    }
    workingDays.add(day);
  }
  if (workingDays.size === 0) throw new Error('SHEETS_SCHEDULE_WORKING_DAYS must list at least one working day');

  const startHourRaw = env.SHEETS_SCHEDULE_START_HOUR ?? DEFAULT_START_HOUR;
  const startHour = Number(startHourRaw);
  if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
    throw new Error(`invalid SHEETS_SCHEDULE_START_HOUR: "${startHourRaw}" — must be an integer 0-23`);
  }

  const workingHoursRaw = env.SHEETS_SCHEDULE_WORKING_HOURS ?? DEFAULT_WORKING_HOURS;
  const workingHours = Number(workingHoursRaw);
  if (!Number.isInteger(workingHours) || workingHours < 1 || workingHours > 24) {
    throw new Error(`invalid SHEETS_SCHEDULE_WORKING_HOURS: "${workingHoursRaw}" — must be an integer 1-24`);
  }

  if (startHour + workingHours > 24) {
    throw new Error(
      `SHEETS_SCHEDULE_START_HOUR (${startHour}) + SHEETS_SCHEDULE_WORKING_HOURS (${workingHours}) crosses midnight in ${timezone}, which is not supported — choose a start hour and duration that stay within one calendar day`,
    );
  }

  return { timezone, workingDays, startHour, workingHours };
}

function localParts(now: Date, timeZone: string): { isoWeekday: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short' }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const isoWeekday = WEEKDAY_TO_ISO[get('weekday')];
  if (!isoWeekday) throw new Error(`could not determine local weekday for timezone "${timeZone}"`);
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // some locales render midnight as "24"
  const minute = Number(get('minute'));
  return { isoWeekday, hour, minute };
}

export function isWithinWorkingWindow(now: Date, config: ScheduleConfig): ScheduleDecision {
  const { isoWeekday, hour, minute } = localParts(now, config.timezone);
  const localTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (!config.workingDays.has(isoWeekday)) {
    return { inWindow: false, reason: `${config.timezone} weekday ${isoWeekday} (${localTime}) is not a configured working day (working days: ${[...config.workingDays].sort().join(',')})` };
  }

  const minutesOfDay = hour * 60 + minute;
  const startMinutes = config.startHour * 60;
  const endMinutes = startMinutes + config.workingHours * 60;
  if (minutesOfDay < startMinutes || minutesOfDay >= endMinutes) {
    const endHour = Math.floor(endMinutes / 60);
    return { inWindow: false, reason: `${config.timezone} local time ${localTime} is outside the working window ${String(config.startHour).padStart(2, '0')}:00-${String(endHour).padStart(2, '0')}:00` };
  }

  return { inWindow: true, reason: `${config.timezone} local time ${localTime} (weekday ${isoWeekday}) is within the configured working window` };
}

export function run(env: NodeJS.ProcessEnv = process.env, now: Date = new Date()): ScheduleDecision {
  const config = parseScheduleConfig(env);
  const decision = isWithinWorkingWindow(now, config);
  console.log(`Schedule gate: ${decision.reason} -> in_window=${decision.inWindow}`);
  if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `in_window=${decision.inWindow}\n`);
  }
  if (env.GITHUB_STEP_SUMMARY) {
    appendFileSync(env.GITHUB_STEP_SUMMARY, `**Sheets schedule gate:** ${decision.reason} → \`in_window=${decision.inWindow}\`\n`);
  }
  return decision;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  try {
    run();
  } catch (err) {
    console.error('scheduleGate failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
