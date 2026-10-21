import { describe, expect, it } from 'vitest';
import type { BusPurchase, WorkDay, WorkStatus } from '../db/types';
import { summarize, ticketsLeft } from './worklog';

const base = { user_id: 'u', created_at: '', updated_at: '', deleted_at: null };
const day = (d: string, status: WorkStatus): WorkDay => ({ ...base, id: d, day: d, status });
const bought = (d: string, tickets = 10): BusPurchase => ({ ...base, id: `p${d}`, bought_on: d, tickets });

describe('summarize', () => {
  it('counts a year and works out the in-office share of working days', () => {
    const days = [
      day('2026-01-02', 'office'),
      day('2026-01-03', 'remote'),
      day('2026-01-04', 'remote'),
      day('2026-01-05', 'off'),
      day('2026-01-06', 'holiday'),
      day('2025-12-31', 'office'), // other year
    ];
    const s = summarize(days, 2026);
    expect(s.counts).toEqual({ office: 1, remote: 2, off: 1, holiday: 1 });
    expect(s.total).toBe(5);
    expect(s.inOfficePct).toBeCloseTo(33.33, 1);
    expect(summarize([], 2026).inOfficePct).toBeNull();
  });
});

describe('ticketsLeft', () => {
  it('takes a round trip per office day up to today', () => {
    const purchases = [bought('2026-01-01', 4), bought('2026-01-06')];
    const days = [day('2026-01-05', 'office'), day('2026-01-06', 'office'), day('2026-01-07', 'remote'), day('2026-01-08', 'office')];
    expect(ticketsLeft(purchases, days, '2026-01-07')).toBe(10); // 14 bought, 2 office days so far
    expect(ticketsLeft(purchases, days, '2026-01-08')).toBe(8);
  });

  it('ignores office days from before tracking began', () => {
    const days = [day('2026-10-14', 'office'), day('2026-10-20', 'office')];
    expect(ticketsLeft([bought('2026-10-15', 6)], days, '2026-10-21')).toBe(4);
    expect(ticketsLeft([], days, '2026-10-21')).toBe(0);
  });
});
