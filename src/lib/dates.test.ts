import { describe, expect, it } from 'vitest';
import { addDays, dayLabel, formatDay, parseDayKey, sinceLabel, weekLabel } from './dates';

const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('day keys', () => {
  it('parses a day as local midnight', () => {
    expect(parseDayKey('2026-03-08')).toEqual(local(2026, 3, 8));
  });

  it('adds days across months, years and daylight-saving changes', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
    expect(addDays('2026-11-01', 7)).toBe('2026-11-08');
  });

  it('formats a day in the local zone', () => {
    expect(formatDay('2026-10-26', { weekday: 'long' })).toBe(local(2026, 10, 26).toLocaleDateString(undefined, { weekday: 'long' }));
  });
});

describe('labels', () => {
  const now = local(2026, 10, 28, 15);

  it('names nearby days and dates the rest, with a year only when it differs', () => {
    expect(dayLabel('2026-10-28', now)).toBe('Today');
    expect(dayLabel('2026-10-29', now)).toBe('Tomorrow');
    expect(dayLabel('2026-10-27', now)).toBe('Yesterday');
    const opts = { weekday: 'short', month: 'short', day: 'numeric' } as const;
    expect(dayLabel('2026-10-20', now)).toBe(local(2026, 10, 20).toLocaleDateString(undefined, opts));
    expect(dayLabel('2025-10-20', now)).toBe(local(2025, 10, 20).toLocaleDateString(undefined, { ...opts, year: 'numeric' }));
  });

  it('names this week and last, and dates older weeks Monday to Sunday', () => {
    expect(weekLabel('2026-10-26', '2026-10-26', now)).toBe('This week');
    expect(weekLabel('2026-10-19', '2026-10-26', now)).toBe('Last week');
    const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(weekLabel('2026-10-12', '2026-10-26', now)).toBe(`${fmt(local(2026, 10, 12))} – ${fmt(local(2026, 10, 18))}`);
  });

  it('gives a start time, with the weekday when it was not today', () => {
    const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const today = local(2026, 10, 28, 9, 5);
    expect(sinceLabel(today.toISOString(), now)).toBe(clock(today));
    const monday = local(2026, 10, 26, 17, 12);
    expect(sinceLabel(monday.toISOString(), now)).toBe(`${monday.toLocaleDateString(undefined, { weekday: 'short' })} ${clock(monday)}`);
  });
});
