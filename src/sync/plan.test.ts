import { describe, expect, it } from 'vitest';
import { planPush } from './plan';

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
