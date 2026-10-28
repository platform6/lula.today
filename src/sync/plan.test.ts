import { describe, expect, it } from 'vitest';
import { backoffMs, isUnreachable, matchFor, planPush } from './plan';

describe('planPush', () => {
  it('updates only the columns that changed', () => {
    const plan = planPush([
      { table: 'time_entries', key: 'a', fields: ['description'] },
      { table: 'time_entries', key: 'a', fields: ['deleted_at', 'description'] },
    ]);
    expect(plan.whole).toEqual([]);
    expect(plan.partial.get('a')?.sort()).toEqual(['deleted_at', 'description']);
  });

  it('sends the whole row when any queued write was whole', () => {
    const plan = planPush([
      { table: 'time_entries', key: 'a', fields: ['ended_at'] },
      { table: 'time_entries', key: 'a' },
      { table: 'time_entries', key: 'a', fields: ['description'] },
      { table: 'time_entries', key: 'b', fields: ['ended_at'] },
    ]);
    expect(plan.whole).toEqual(['a']);
    expect([...plan.partial.keys()]).toEqual(['b']);
  });
});

describe('retrying', () => {
  it('backs off from 5 seconds, doubling, up to 5 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([5_000, 10_000, 20_000, 40_000]);
    expect(backoffMs(20)).toBe(300_000);
  });

  it('tells an unreachable server from a refused change', () => {
    expect(isUnreachable('TypeError: Failed to fetch')).toBe(true);
    expect(isUnreachable('Load failed')).toBe(true);
    expect(isUnreachable('column "colour" of relation "tasks" does not exist')).toBe(false);
    expect(isUnreachable('new row violates row-level security policy')).toBe(false);
  });

  it('finds a row on the server from its outbox key', () => {
    expect(matchFor('id', 'abc')).toEqual({ id: 'abc' });
    expect(matchFor('task_id,label_id', 't1|l2')).toEqual({ task_id: 't1', label_id: 'l2' });
  });
});
