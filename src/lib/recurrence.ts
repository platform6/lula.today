import type { Recurrence, RepeatPreset } from '../db/types';
import { dayKey, formatDay } from './dates';

// Recurring tasks are one task whose due date moves forward each time it is
// completed or skipped. Everything here is local-calendar date math.

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const addDays = (d: Date, k: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k, d.getHours(), d.getMinutes());
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Which occurrence of its weekday a date is in its month (the 21st is the 3rd Wednesday). */
export const nthOfMonth = (d: Date) => Math.ceil(d.getDate() / 7);

function addMonths(d: Date, k: number, mode: 'day' | 'nth'): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + k, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  if (mode === 'nth') {
    const offset = (d.getDay() - first.getDay() + 7) % 7;
    let day = 1 + offset + (nthOfMonth(d) - 1) * 7;
    if (day > daysIn(y, m)) day -= 7; // no 5th Wednesday this month: use the last one
    return new Date(y, m, day, d.getHours(), d.getMinutes());
  }
  return new Date(y, m, Math.min(d.getDate(), daysIn(y, m)), d.getHours(), d.getMinutes());
}

/** The rule a preset stands for, anchored on the task's due date. */
export function presetRule(preset: Exclude<RepeatPreset, 'custom'>, due: Date, from: Recurrence['from'] = 'due'): Recurrence {
  switch (preset) {
    case 'daily':
      return { preset, unit: 'day', every: 1, from };
    case 'weekdays':
      return { preset, unit: 'week', every: 1, days: [1, 2, 3, 4, 5], from };
    case 'weekly':
      return { preset, unit: 'week', every: 1, days: [due.getDay()], from };
    case 'monthly':
      return { preset, unit: 'month', every: 1, month_mode: 'day', from };
    case 'yearly':
      return { preset, unit: 'year', every: 1, from };
  }
}

/** One step of the rule after `d`. */
function step(rule: Recurrence, d: Date): Date {
  const every = Math.max(1, rule.every);
  if (rule.unit === 'day') return addDays(d, every);
  if (rule.unit === 'month') return addMonths(d, every, rule.month_mode ?? 'day');
  if (rule.unit === 'year') return addMonths(d, 12 * every, 'day');
  // Weeks. Counting from completion ignores weekdays; "weekdays" still means Mon–Fri.
  if (rule.from === 'done' && rule.preset !== 'weekdays') return addDays(d, 7 * every);
  const days = rule.days?.length ? rule.days : [d.getDay()];
  for (let i = d.getDay() + 1; i < 7; i++) if (days.includes(i)) return addDays(d, i - d.getDay());
  const weekStart = addDays(d, -d.getDay() + 7 * (rule.preset === 'weekdays' ? 1 : every));
  for (let i = 0; i < 7; i++) if (days.includes(i)) return addDays(weekStart, i);
  return addDays(d, 7 * every);
}

/**
 * The next due date after finishing (or skipping) the current one, or null when
 * the series has ended. A fixed schedule skips past dates already gone by, so a
 * daily task left for a week comes back today, not a week ago.
 */
export function nextDue(rule: Recurrence, dueAt: string | null, now = new Date()): Date | null {
  const due = dueAt ? new Date(dueAt) : null;
  let base: Date;
  if (rule.from === 'done' || !due) {
    base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), due?.getHours() ?? 0, due?.getMinutes() ?? 0);
  } else {
    base = due;
  }
  let next = step(rule, base);
  const today = dayKey(now);
  for (let i = 0; i < 1000 && dayKey(next) <= today && rule.from === 'due'; i++) next = step(rule, next);
  if (rule.count && (rule.done ?? 0) + 1 >= rule.count) return null;
  if (rule.until && dayKey(next) > rule.until) return null;
  return next;
}

const unitText = (rule: Recurrence) => (rule.every === 1 ? rule.unit : `${rule.every} ${rule.unit}s`);

/** Full sentence for the picker and task details, e.g. "Every 2 weeks on Mon, Thu". */
export function describe(rule: Recurrence, due: Date): string {
  let text: string;
  if (rule.from === 'done') {
    const lead = rule.preset === 'weekdays' ? 'The next weekday' : rule.every === 1 ? `A ${rule.unit}` : unitText(rule);
    text = `${lead} after each completion`;
  } else if (rule.preset === 'daily') text = 'Every day';
  else if (rule.preset === 'weekdays') text = 'Every weekday';
  else {
    text = `Every ${unitText(rule)}`;
    if (rule.unit === 'week') {
      const days = rule.days?.length ? [...rule.days].sort() : [due.getDay()];
      text += ' on ' + (days.length === 1 ? DAY_NAMES[days[0]] : days.map((d) => DAY_NAMES[d].slice(0, 3)).join(', '));
    } else if (rule.unit === 'month') {
      text += rule.month_mode === 'nth' ? ` on the ${ordinal(nthOfMonth(due))} ${DAY_NAMES[due.getDay()]}` : ` on the ${ordinal(due.getDate())}`;
    } else if (rule.unit === 'year') {
      text += ` on ${MONTH_NAMES[due.getMonth()]} ${due.getDate()}`;
    }
  }
  if (rule.until) {
    text += `, until ${formatDay(rule.until, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }
  if (rule.count) text += `, ${rule.count} times`;
  return text;
}

/** Short badge text for task rows, e.g. "Weekly" or "Every 2 weeks". */
export function describeShort(rule: Recurrence): string {
  const named: Partial<Record<RepeatPreset, string>> = {
    daily: 'Daily',
    weekdays: 'Weekdays',
    weekly: 'Weekly',
    monthly: 'Monthly',
    yearly: 'Yearly',
  };
  return named[rule.preset] ?? `Every ${unitText(rule)}`;
}

/** Lower-case phrase for sentences like "Repeats every week." */
export function describeLower(rule: Recurrence): string {
  const named: Partial<Record<RepeatPreset, string>> = {
    daily: 'every day',
    weekdays: 'every weekday',
    weekly: 'every week',
    monthly: 'every month',
    yearly: 'every year',
  };
  const text = named[rule.preset] ?? `every ${unitText(rule)}`;
  return rule.from === 'done' ? `${text}, counted from when you complete it` : text;
}

/**
 * Later occurrences of a repeating task, after its current due date and up to
 * `until`, for showing ahead on the calendar. Only fixed schedules can be
 * projected: a rule counted from completion has no dates until it's completed.
 */
export function upcomingOccurrences(rule: Recurrence, dueAt: string, until: Date, max = 400): Date[] {
  if (rule.from === 'done') return [];
  const out: Date[] = [];
  let current = new Date(dueAt);
  let done = rule.done ?? 0;
  for (let i = 0; i < max; i++) {
    const next = nextDue({ ...rule, done }, current.toISOString(), current);
    if (!next || next > until) break;
    out.push(next);
    current = next;
    done++;
  }
  return out;
}
