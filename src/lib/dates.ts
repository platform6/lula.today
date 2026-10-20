// Date-only due dates are stored as local midnight; timed ones as the exact instant.

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now = new Date()): string {
  return dayKey(now);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days));
}

/** Build a due_at ISO string from date (YYYY-MM-DD) and optional time (HH:MM) inputs. */
export function toDueAt(date: string, time?: string): string | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time ? time.split(':').map(Number) : [0, 0];
  return new Date(y, m - 1, d, hh, mm).toISOString();
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
