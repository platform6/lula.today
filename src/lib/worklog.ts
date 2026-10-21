import type { BusPurchase, WorkDay, WorkStatus } from '../db/types';
import { stableUuid } from './ids';

// The work log: where each day was worked, the in-office percentage, and how
// many bus tickets are left. Dates are YYYY-MM-DD strings.

export const WORK_STATUSES: { key: WorkStatus; label: string; short: string; color: string }[] = [
  { key: 'office', label: 'Office', short: 'Office', color: 'var(--accent)' },
  { key: 'remote', label: 'Remote', short: 'Remote', color: 'var(--prio-1)' },
  { key: 'off', label: 'Off', short: 'Off', color: 'var(--muted)' },
  { key: 'holiday', label: 'Holiday', short: 'Holiday', color: 'var(--ok)' },
];

export const statusInfo = (s: WorkStatus) => WORK_STATUSES.find((w) => w.key === s)!;

/** Each office day is a round trip: one ticket there, one back. */
export const TICKETS_PER_OFFICE_DAY = 2;
export const PACK_SIZE = 10;
/** Warn once only one round trip is left. */
export const LOW_TICKETS = TICKETS_PER_OFFICE_DAY;

/** The same id on every device for a given day, so two devices marking it converge on one row. */
export const workDayId = (userId: string, day: string) => stableUuid(`${userId}:work_day:${day}`);

export interface YearSummary {
  counts: Record<WorkStatus, number>;
  total: number;
  /** Office days as a share of working days (office + remote), as in the old spreadsheet; null when none. */
  inOfficePct: number | null;
}

export function summarize(days: WorkDay[], year: number): YearSummary {
  const counts: Record<WorkStatus, number> = { office: 0, remote: 0, off: 0, holiday: 0 };
  for (const d of days) if (!d.deleted_at && d.day.startsWith(`${year}-`)) counts[d.status]++;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const working = counts.office + counts.remote;
  return { counts, total, inOfficePct: working ? (counts.office / working) * 100 : null };
}

/**
 * Tickets bought, less a round trip for every office day from when tracking
 * began (the first purchase, which may be a starting balance) up to and
 * including `today`. Office days logged before tracking began use nothing.
 */
export function ticketsLeft(purchases: BusPurchase[], days: WorkDay[], today: string): number {
  const live = purchases.filter((p) => !p.deleted_at);
  if (live.length === 0) return 0;
  const since = live.reduce((min, p) => (p.bought_on < min ? p.bought_on : min), live[0].bought_on);
  const bought = live.reduce((n, p) => n + p.tickets, 0);
  const used = days.filter((d) => !d.deleted_at && d.status === 'office' && d.day >= since && d.day <= today).length;
  return bought - used * TICKETS_PER_OFFICE_DAY;
}
