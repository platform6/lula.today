// Date-only due dates are stored as local midnight; timed ones as the exact instant.

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

/** A day (YYYY-MM-DD) as local midnight. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** A day (YYYY-MM-DD) in the reader's locale, e.g. formatDay(key, { month: 'short', day: 'numeric' }). */
export const formatDay = (key: string, opts: Intl.DateTimeFormatOptions) => parseDayKey(key).toLocaleDateString(undefined, opts);

const yearIfNot = (d: Date, now: Date): Intl.DateTimeFormatOptions =>
  d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {};

/** "Today", "Tomorrow", "Yesterday", else "Mon, Oct 26" (with the year when it isn't this year). */
export function dayLabel(key: string, now = new Date()): string {
  const today = todayKey(now);
  if (key === today) return 'Today';
  if (key === addDays(today, 1)) return 'Tomorrow';
  if (key === addDays(today, -1)) return 'Yesterday';
  const d = parseDayKey(key);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...yearIfNot(d, now) });
}

/** The week starting on `monday`: "This week", "Last week", else "Oct 12 – Oct 18". */
export function weekLabel(monday: string, thisMonday: string, now = new Date()): string {
  if (monday === thisMonday) return 'This week';
  if (monday === addDays(thisMonday, -7)) return 'Last week';
  const fmt = (key: string) => {
    const d = parseDayKey(key);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...yearIfNot(d, now) });
  };
  return `${fmt(monday)} – ${fmt(addDays(monday, 6))}`;
}

/** A time of day: "5:12 PM". */
export const clockLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "5:12 PM", or "Mon 5:12 PM" when it's not today. */
export function sinceLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = clockLabel(iso);
  return dayKey(d) === dayKey(now) ? time : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

/** Build a due_at ISO string from date (YYYY-MM-DD) and optional time (HH:MM) inputs. */
export function toDueAt(date: string, time?: string): string | null {
  if (!date) return null;
  const d = parseDayKey(date);
  const [hh, mm] = time ? time.split(':').map(Number) : [0, 0];
  d.setHours(hh, mm);
  return d.toISOString();
}

export function dueDateInput(dueAt: string | null): string {
  return dueAt ? dayKey(new Date(dueAt)) : '';
}

export function dueTimeInput(dueAt: string | null, hasTime: boolean): string {
  if (!dueAt || !hasTime) return '';
  const d = new Date(dueAt);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function isOverdue(dueAt: string | null, hasTime: boolean, now = new Date()): boolean {
  if (!dueAt) return false;
  if (hasTime) return new Date(dueAt).getTime() < now.getTime();
  return dayKey(new Date(dueAt)) < todayKey(now);
}

export function formatDue(dueAt: string, hasTime: boolean, now = new Date()): string {
  const d = new Date(dueAt);
  const key = dayKey(d);
  const today = todayKey(now);
  let label: string;
  if (key === today) label = 'Today';
  else if (key === addDays(today, 1)) label = 'Tomorrow';
  else if (key === addDays(today, -1)) label = 'Yesterday';
  else
    label = d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
    });
  if (hasTime) label += ` ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  return label;
}
