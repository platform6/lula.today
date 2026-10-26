import { addDays } from './dates';

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

/** Name used to match tasks and tags: trimmed, spaces collapsed, case ignored. */
export const nameKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** A running timer's clock: 5:03, 1:05:03. */
export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** A total, to the minute: 45m, 2h 05m. */
export function formatHours(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export type Period = 'week' | 'month' | 'year' | 'all';

export const PERIOD_LABELS: Record<Period, string> = {
  week: 'This week',
  month: 'This month',
  year: 'This year',
  all: 'All time',
};

/** Local start of the period containing `now` (weeks start Monday), or null for all time. */
export function periodStart(period: Period, now = new Date()): Date | null {
  if (period === 'all') return null;
  const d = new Date(now.getFullYear(), period === 'year' ? 0 : now.getMonth(), period === 'week' ? now.getDate() : 1);
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
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

/** A duration for the entry form: 1:05, 0:45. */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * A typed duration in seconds, or null if it can't be read: 1:30, 1h 30m, 1h,
 * 45m, 1.5h, or a bare number of minutes.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase();
  let m = /^(\d+):([0-5]?\d)$/.exec(s);
  if (m) return (Number(m[1]) * 60 + Number(m[2])) * 60;
  m = /^(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(s);
  if (m && (m[1] || m[2])) return Math.round((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60);
  if (/^\d+$/.test(s)) return Number(s) * 60;
  return null;
}

/** The Monday (YYYY-MM-DD) of the week a day (YYYY-MM-DD) falls in. */
export function weekOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = (new Date(y, m - 1, d).getDay() + 6) % 7;
  return addDays(day, -weekday);
}
