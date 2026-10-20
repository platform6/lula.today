import { describe, expect, it } from 'vitest';
import { byPosition, keyAtEnd, keyAtIndex, keyAtStart, keyBetween } from './position';
import { isArchived, normalizeUrl } from './tasks';
import { addDays, isOverdue, toDueAt } from './dates';
import type { Task } from '../db/types';

describe('position', () => {
  it('generates keys that sort in insertion order', () => {
    const items: { id: string; position: string }[] = [];
    items.push({ id: 'a', position: keyAtEnd(items) });
    items.push({ id: 'b', position: keyAtEnd(items.sort(byPosition)) });
    items.push({ id: 'c', position: keyAtStart(items.sort(byPosition)) });
    items.push({ id: 'd', position: keyAtIndex(items.sort(byPosition), 1) });
    expect(items.sort(byPosition).map((i) => i.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('survives colliding keys from two devices', () => {
    const k = keyBetween(null, null);
    expect(keyBetween(k, k) > k).toBe(true);
  });
});

const task = (over: Partial<Task>): Task => ({
  id: 't',
  user_id: 'u',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  project_id: 'p',
  column_id: 'c',
  title: 'x',
  notes: null,
  url: null,
  priority: 0,
  due_at: null,
  due_has_time: false,
  completed_at: null,
  archived_at: null,
  position: 'a0',
  ...over,
});

describe('auto-archive', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  it('archives tasks completed more than 7 days ago', () => {
    expect(isArchived(task({ completed_at: '2026-10-12T11:00:00Z' }), now)).toBe(true);
    expect(isArchived(task({ completed_at: '2026-10-14T12:00:00Z' }), now)).toBe(false);
    expect(isArchived(task({}), now)).toBe(false);
    expect(isArchived(task({ archived_at: '2026-10-20T00:00:00Z' }), now)).toBe(true);
  });
});

describe('dates and urls', () => {
  it('treats date-only due dates as overdue only after the day ends', () => {
    const now = new Date(2026, 9, 20, 18, 0);
    expect(isOverdue(toDueAt('2026-10-20'), false, now)).toBe(false);
    expect(isOverdue(toDueAt('2026-10-19'), false, now)).toBe(true);
    expect(isOverdue(toDueAt('2026-10-20', '09:00'), true, now)).toBe(true);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('normalizes bare domains', () => {
    expect(normalizeUrl('example.com/x')).toBe('https://example.com/x');
    expect(normalizeUrl('mailto:a@b.c')).toBe('mailto:a@b.c');
    expect(normalizeUrl('  ')).toBeNull();
  });
});
