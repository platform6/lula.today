import { describe as group, expect, it } from 'vitest';
import type { Recurrence } from '../db/types';
import { describe, describeShort, nextDue, presetRule } from './recurrence';
import { dayKey } from './dates';

// Wednesday, October 21, 2026 (local midnight, as date-only due dates are stored).
const WED = new Date(2026, 9, 21);
const due = WED.toISOString();
const key = (d: Date | null) => (d ? dayKey(d) : null);

group('nextDue on a fixed schedule', () => {
  it('steps each preset from the due date', () => {
    expect(key(nextDue(presetRule('daily', WED), due, WED))).toBe('2026-10-22');
    expect(key(nextDue(presetRule('weekly', WED), due, WED))).toBe('2026-10-28');
    expect(key(nextDue(presetRule('monthly', WED), due, WED))).toBe('2026-11-21');
    expect(key(nextDue(presetRule('yearly', WED), due, WED))).toBe('2027-10-21');
  });

  it('runs weekdays Monday to Friday', () => {
    const fri = new Date(2026, 9, 23);
    expect(key(nextDue(presetRule('weekdays', WED), due, WED))).toBe('2026-10-22');
    expect(key(nextDue(presetRule('weekdays', fri), fri.toISOString(), fri))).toBe('2026-10-26');
  });

  it('picks the next chosen weekday, then jumps by the interval', () => {
    const rule: Recurrence = { preset: 'custom', unit: 'week', every: 2, days: [1, 4], from: 'due' };
    expect(key(nextDue(rule, due, WED))).toBe('2026-10-22'); // Thursday, same week
    const thu = new Date(2026, 9, 22);
    expect(key(nextDue(rule, thu.toISOString(), thu))).toBe('2026-11-02'); // Monday, two weeks on
  });

  it('keeps the same weekday occurrence for "3rd Wednesday" months', () => {
    const rule: Recurrence = { preset: 'custom', unit: 'month', every: 1, month_mode: 'nth', from: 'due' };
    expect(key(nextDue(rule, due, WED))).toBe('2026-11-18');
  });

  it('clamps month-end days', () => {
    const jan31 = new Date(2027, 0, 31);
    expect(key(nextDue(presetRule('monthly', jan31), jan31.toISOString(), jan31))).toBe('2027-02-28');
  });

  it('skips occurrences that have already gone by', () => {
    const weekLater = new Date(2026, 9, 28);
    expect(key(nextDue(presetRule('daily', WED), due, weekLater))).toBe('2026-10-29');
  });

  it('keeps the time of day', () => {
    const at8 = new Date(2026, 9, 21, 8, 0);
    const next = nextDue(presetRule('daily', at8), at8.toISOString(), WED)!;
    expect([next.getHours(), next.getMinutes()]).toEqual([8, 0]);
  });
});

group('nextDue counted from completion', () => {
  it('counts from the day it was completed', () => {
    const rule: Recurrence = { preset: 'custom', unit: 'week', every: 2, days: [1], from: 'done' };
    const finishedLate = new Date(2026, 9, 25);
    expect(key(nextDue(rule, due, finishedLate))).toBe('2026-11-08');
  });
});

group('nextDue end conditions', () => {
  it('ends after the last date', () => {
    const rule = { ...presetRule('weekly', WED), until: '2026-10-27' };
    expect(nextDue(rule, due, WED)).toBeNull();
  });

  it('ends after a number of times', () => {
    const rule = { ...presetRule('daily', WED), count: 3, done: 1 };
    expect(key(nextDue(rule, due, WED))).toBe('2026-10-22');
    expect(nextDue({ ...rule, done: 2 }, due, WED)).toBeNull();
  });
});

group('describe', () => {
  it('reads like the picker', () => {
    expect(describe(presetRule('weekly', WED), WED)).toBe('Every week on Wednesday');
    expect(describe(presetRule('monthly', WED), WED)).toBe('Every month on the 21st');
    expect(describe({ preset: 'custom', unit: 'week', every: 2, days: [4, 1], from: 'due' }, WED)).toBe('Every 2 weeks on Mon, Thu');
    expect(describe({ preset: 'custom', unit: 'month', every: 1, month_mode: 'nth', from: 'due' }, WED)).toBe('Every month on the 3rd Wednesday');
    expect(describe({ preset: 'custom', unit: 'week', every: 2, from: 'done' }, WED)).toBe('2 weeks after each completion');
    expect(describe({ ...presetRule('daily', WED), count: 5 }, WED)).toBe('Every day, 5 times');
    expect(describeShort({ preset: 'custom', unit: 'week', every: 2, from: 'due' })).toBe('Every 2 weeks');
  });
});
