import { addDays, dayKey, parseDayKey, todayKey } from './dates';

// Time tracking helpers that don't touch the database.

/** Offset of `zone` from UTC at `utc` (ms), e.g. -4h for New York in summer. */
function zoneOffset(utc: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utc));
  const n = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
  return wall - Math.floor(utc / 1000) * 1000;
}

/** A wall-clock date (YYYY-MM-DD) and time (HH:MM[:SS]) in `zone`, as an ISO instant. */
export function zonedToUtc(date: string, time: string, zone: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min, s = 0] = time.split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, h, min, s);
  // Two passes settle the offset, including next to a daylight-saving change.
  let utc = wall - zoneOffset(wall, zone);
  utc = wall - zoneOffset(utc, zone);
  return new Date(utc).toISOString();
}

/** Seconds between start and end (or `now` while running). */
export function entrySeconds(e: { started_at: string; ended_at: string | null }, now = Date.now()): number {
  const end = e.ended_at ? Date.parse(e.ended_at) : now;
  return Math.max(0, Math.round((end - Date.parse(e.started_at)) / 1000));
}

/** A timer running this long was probably left on (overnight, say). */
export const LONG_RUN_SECONDS = 8 * 3600;

export const runningLong = (e: { started_at: string; ended_at: string | null }, now = Date.now()) =>
  !e.ended_at && entrySeconds(e, now) >= LONG_RUN_SECONDS;

/** What's wrong with an entry's times, or null if they're fine. A running entry has no end. */
export function timesProblem(startedAt: string, endedAt: string | null, now = Date.now()): string | null {
  const start = Date.parse(startedAt);
  if (start > now) return "The start can't be in the future.";
  if (endedAt === null) return null;
  const end = Date.parse(endedAt);
  if (end > now) return "The end can't be in the future.";
  if (end <= start) return 'The end must be after the start.';
  return null;
}

/** Name used to match tasks and tags: trimmed, spaces collapsed, case ignored. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

export type RangeKind = 'week' | 'lastWeek' | 'twoWeeks' | 'month' | 'lastMonth' | 'custom';

export const RANGE_LABELS: Record<RangeKind, string> = {
  week: 'This week',
  lastWeek: 'Last week',
  twoWeeks: 'Past two weeks',
  month: 'This month',
  lastMonth: 'Last month',
  custom: 'Custom',
};

/** Days from `from` to `to` (YYYY-MM-DD), both included. */
export interface DayRange {
  kind: RangeKind;
  from: string;
  to: string;
}

function monthRange(kind: RangeKind, year: number, month: number): DayRange {
  return { kind, from: dayKey(new Date(year, month, 1)), to: dayKey(new Date(year, month + 1, 0)) };
}

/** The range a kind names, as of `today` (weeks start Monday). Custom starts as this week. */
export function rangeFor(kind: RangeKind, today = todayKey()): DayRange {
  const monday = weekOf(today);
  const t = parseDayKey(today);
  switch (kind) {
    case 'lastWeek':
      return { kind, from: addDays(monday, -7), to: addDays(monday, -1) };
    case 'twoWeeks':
      return { kind, from: addDays(today, -13), to: today };
    case 'month':
      return monthRange(kind, t.getFullYear(), t.getMonth());
    case 'lastMonth':
      return monthRange(kind, t.getFullYear(), t.getMonth() - 1);
    default:
      return { kind, from: monday, to: addDays(monday, 6) };
  }
}

/** Every day in a range, oldest first. */
export function rangeDays(r: DayRange): string[] {
  const days: string[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) days.push(d);
  return days;
}

/** The range before (-1) or after (1): a month for month ranges, else the same number of days. */
export function stepRange(r: DayRange, dir: 1 | -1): DayRange {
  if (r.kind === 'month' || r.kind === 'lastMonth') {
    const f = parseDayKey(r.from);
    return monthRange(r.kind, f.getFullYear(), f.getMonth() + dir);
  }
  const length = rangeDays(r).length;
  return { kind: r.kind, from: addDays(r.from, dir * length), to: addDays(r.to, dir * length) };
}

/** The range with its ends in order, for a custom range typed back to front. */
export const ordered = (r: DayRange): DayRange => (r.from <= r.to ? r : { ...r, from: r.to, to: r.from });

/** A long range's chart shows a bar a week or a month rather than thousands of days. */
export type Bucket = 'day' | 'week' | 'month';

export const bucketFor = (days: number): Bucket => (days > 731 ? 'month' : days > 92 ? 'week' : 'day');

/** The bucket a day (YYYY-MM-DD) falls in, keyed by its first day. */
export const bucketOf = (day: string, b: Bucket) => (b === 'day' ? day : b === 'week' ? weekOf(day) : `${day.slice(0, 7)}-01`);

/** The buckets a range covers, oldest first. */
export function rangeBuckets(r: DayRange): { bucket: Bucket; keys: string[] } {
  const days = rangeDays(r);
  const bucket = bucketFor(days.length);
  return { bucket, keys: [...new Set(days.map((d) => bucketOf(d, bucket)))] };
}

/** "This week" when the range is the current one, else its dates: "Sep 2026", "Oct 13 – Oct 19". */
export function rangeLabel(r: DayRange, today = todayKey()): string {
  const now = rangeFor(r.kind, today);
  if (r.kind !== 'custom' && now.from === r.from && now.to === r.to) return RANGE_LABELS[r.kind];
  const year = parseDayKey(today).getFullYear();
  const from = parseDayKey(r.from);
  const to = parseDayKey(r.to);
  if (r.kind === 'month' || r.kind === 'lastMonth') {
    return from.toLocaleDateString(undefined, { month: 'long', ...(from.getFullYear() !== year ? { year: 'numeric' } : {}) });
  }
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== year ? { year: 'numeric' } : {}) });
  return r.from === r.to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`;
}

/** Total seconds per key, largest first. Entries whose key is undefined are skipped. */
export function totalsBy<E extends { started_at: string; ended_at: string | null }>(
  entries: E[],
  keyOf: (e: E) => string | undefined,
  now = Date.now(),
): { key: string; seconds: number }[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const key = keyOf(e);
    if (key !== undefined) totals.set(key, (totals.get(key) ?? 0) + entrySeconds(e, now));
  }
  return [...totals].map(([key, seconds]) => ({ key, seconds })).sort((a, b) => b.seconds - a.seconds);
}

/** A duration as Clockify shows it: 01:27:29. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * A typed duration in seconds, or null if it can't be read: 1:30, 1:30:15,
 * 1h 30m, 1h, 45m, 1.5h, or a bare number of minutes.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase();
  let m = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(s);
  if (m) return (Number(m[1]) * 60 + Number(m[2])) * 60 + Number(m[3] ?? 0);
  m = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(s);
  if (m && (m[1] || m[2])) return Math.round((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60);
  if (/^\d+$/.test(s)) return Number(s) * 60;
  return null;
}

type Stackable = { started_at: string; ended_at: string | null; project_id: string | null; time_task_id: string | null; description: string | null; tag_ids: string[] };

/**
 * A day's entries with repeats stacked, as in Clockify: finished entries with the
 * same project, task, description and tags share a stack, in order of first appearance.
 */
export function stackEntries<E extends Stackable>(entries: E[]): E[][] {
  const stacks = new Map<string, E[]>();
  entries.forEach((e, i) => {
    const key = e.ended_at
      ? [e.project_id, e.time_task_id, e.description ?? '', [...e.tag_ids].sort().join(',')].join('|')
      : `running:${i}`;
    stacks.set(key, [...(stacks.get(key) ?? []), e]);
  });
  return [...stacks.values()];
}

/** The Monday (YYYY-MM-DD) of the week a day (YYYY-MM-DD) falls in. */
export function weekOf(day: string): string {
  const weekday = (parseDayKey(day).getDay() + 6) % 7;
  return addDays(day, -weekday);
}
