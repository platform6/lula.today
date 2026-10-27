import { describe, expect, it } from 'vitest';
import { entrySeconds, formatClock, formatDuration, formatHours, nameKey, parseDuration, periodStart, stackEntries, timesProblem, totalsBy, weekOf, zonedToUtc } from './time';
import { planImport, type OldEntry } from './timeImport';

describe('zonedToUtc', () => {
  it('reads New York wall-clock times in summer and winter', () => {
    expect(zonedToUtc('2026-07-01', '14:00:00', 'America/New_York')).toBe('2026-07-01T18:00:00.000Z');
    expect(zonedToUtc('2026-01-15', '09:30', 'America/New_York')).toBe('2026-01-15T14:30:00.000Z');
  });

  it('handles the days daylight saving starts and ends', () => {
    expect(zonedToUtc('2026-03-08', '01:30:00', 'America/New_York')).toBe('2026-03-08T06:30:00.000Z');
    expect(zonedToUtc('2026-03-08', '03:30:00', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
    expect(zonedToUtc('2026-11-01', '12:00:00', 'America/New_York')).toBe('2026-11-01T17:00:00.000Z');
  });
});

describe('entrySeconds', () => {
  it('measures finished and running entries', () => {
    expect(entrySeconds({ started_at: '2026-10-22T10:00:00Z', ended_at: '2026-10-22T11:30:05Z' })).toBe(5405);
    expect(entrySeconds({ started_at: '2026-10-22T10:00:00Z', ended_at: null }, Date.parse('2026-10-22T10:00:42Z'))).toBe(42);
  });
});

describe('formatting', () => {
  it('shows a running clock and rounded totals', () => {
    expect(formatClock(303)).toBe('5:03');
    expect(formatClock(3903)).toBe('1:05:03');
    expect(formatHours(2700)).toBe('45m');
    expect(formatHours(7500)).toBe('2h 05m');
    expect(formatHours(20)).toBe('0m');
  });
});

describe('periodStart', () => {
  it('starts weeks on Monday and months and years on the 1st', () => {
    const sun = new Date(2026, 9, 25, 15, 30); // Sunday Oct 25
    expect(periodStart('week', sun)).toEqual(new Date(2026, 9, 19));
    expect(periodStart('week', new Date(2026, 9, 19, 8))).toEqual(new Date(2026, 9, 19));
    expect(periodStart('month', sun)).toEqual(new Date(2026, 9, 1));
    expect(periodStart('year', sun)).toEqual(new Date(2026, 0, 1));
    expect(periodStart('all', sun)).toBeNull();
  });
});

describe('totalsBy', () => {
  it('adds up seconds per key, largest first, counting a running entry to now', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    const rows = [
      { k: 'a', started_at: '2026-10-22T10:00:00Z', ended_at: '2026-10-22T10:30:00Z' },
      { k: 'b', started_at: '2026-10-22T09:00:00Z', ended_at: '2026-10-22T10:00:00Z' },
      { k: 'a', started_at: '2026-10-22T11:00:00Z', ended_at: null },
      { k: undefined, started_at: '2026-10-22T08:00:00Z', ended_at: '2026-10-22T09:00:00Z' },
    ];
    expect(totalsBy(rows, (r) => r.k, now)).toEqual([
      { key: 'a', seconds: 5400 },
      { key: 'b', seconds: 3600 },
    ]);
  });
});

describe('nameKey', () => {
  it('ignores case and extra spaces', () => {
    expect(nameKey('  Game   Art ')).toBe(nameKey('game art'));
  });
});

describe('durations', () => {
  it('reads the ways a duration is typed', () => {
    expect(parseDuration('1:30')).toBe(5400);
    expect(parseDuration('0:05')).toBe(300);
    expect(parseDuration('1h 30m')).toBe(5400);
    expect(parseDuration('2h')).toBe(7200);
    expect(parseDuration('1.5h')).toBe(5400);
    expect(parseDuration('45m')).toBe(2700);
    expect(parseDuration(' 45 ')).toBe(2700);
  });

  it('rejects what it cannot read', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:75')).toBeNull();
  });

  it('reads hours, minutes and seconds', () => {
    expect(parseDuration('1:27:29')).toBe(5249);
    expect(parseDuration('00:00:30')).toBe(30);
  });

  it('formats as Clockify does', () => {
    expect(formatDuration(5249)).toBe('01:27:29');
    expect(formatDuration(300)).toBe('00:05:00');
    expect(formatDuration(45 * 3600)).toBe('45:00:00');
    expect(formatDuration(parseDuration('1h 5m')!)).toBe('01:05:00');
  });
});

describe('stackEntries', () => {
  const e = (o: Partial<Parameters<typeof stackEntries>[0][number]>) => ({
    started_at: '2026-10-26T10:00:00Z',
    ended_at: '2026-10-26T11:00:00Z',
    project_id: 'p1',
    time_task_id: null,
    description: null,
    tag_ids: [],
    ...o,
  });

  it('stacks repeats and keeps the order they first appear in', () => {
    const a1 = e({});
    const b = e({ project_id: 'p2' });
    const a2 = e({ started_at: '2026-10-26T08:00:00Z' });
    expect(stackEntries([a1, b, a2])).toEqual([[a1, a2], [b]]);
  });

  it('keeps entries apart when the task, description or tags differ', () => {
    const list = [e({}), e({ time_task_id: 't' }), e({ description: 'x' }), e({ tag_ids: ['a'] })];
    expect(stackEntries(list)).toHaveLength(4);
    expect(stackEntries([e({ tag_ids: ['a', 'b'] }), e({ tag_ids: ['b', 'a'] })])).toHaveLength(1);
  });

  it('never stacks a running entry', () => {
    expect(stackEntries([e({ ended_at: null }), e({})])).toHaveLength(2);
  });
});

describe('timesProblem', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  it('accepts past entries and running timers', () => {
    expect(timesProblem('2026-10-27T10:00:00Z', '2026-10-27T11:00:00Z', now)).toBeNull();
    expect(timesProblem('2026-10-27T10:00:00Z', '2026-10-27T12:00:00Z', now)).toBeNull();
    expect(timesProblem('2026-10-27T10:00:00Z', null, now)).toBeNull();
  });

  it('rejects future, empty and backwards times', () => {
    expect(timesProblem('2026-10-27T13:00:00Z', null, now)).toMatch(/start/);
    expect(timesProblem('2026-10-27T11:00:00Z', '2026-10-27T12:30:00Z', now)).toMatch(/end can't/);
    expect(timesProblem('2026-10-27T11:00:00Z', '2026-10-27T11:00:00Z', now)).toMatch(/after the start/);
    expect(timesProblem('2026-10-27T11:00:00Z', '2026-10-27T10:00:00Z', now)).toMatch(/after the start/);
  });
});

describe('weekOf', () => {
  it('is the Monday of the week', () => {
    expect(weekOf('2026-10-26')).toBe('2026-10-26'); // Monday
    expect(weekOf('2026-10-28')).toBe('2026-10-26');
    expect(weekOf('2026-11-01')).toBe('2026-10-26'); // Sunday
    expect(weekOf('2026-01-01')).toBe('2025-12-29'); // across a year
  });
});

const old = (o: Partial<OldEntry>): OldEntry => ({
  id: crypto.randomUUID(),
  project: null,
  task: null,
  description: null,
  tags: [],
  start_date: '2026-07-01',
  start_time: '10:00:00',
  end_date: '2026-07-01',
  end_time: '11:00:00',
  duration_seconds: 3600,
  metadata: null,
  ...o,
});

const realms = [
  { id: 'vg', name: 'Video Games' },
  { id: 'move', name: 'Move' },
  { id: 'art', name: 'Art' },
  { id: 'work', name: 'Work' },
];
// Each realm's own list.
const own = realms.map((r) => ({ id: `own-${r.id}`, area_id: r.id, name: r.name, is_area_default: true }));

describe('planImport', () => {
  it('maps projects to realms and merges duplicate task names', async () => {
    const plan = await planImport(
      'u',
      [
        old({ project: 'Video Games', task: 'Balatro', tags: ['PC'] }),
        old({ project: 'Playing Video Games', task: 'Ballatro', tags: ['pc '] }),
        old({ project: 'Art/Drawing', task: 'Game art' }),
        old({ project: 'Art/Drawing', task: 'Game Art' }),
        old({ project: 'Mystery', task: '' }),
      ],
      realms,
      own,
    );
    const vg = plan.entries.slice(0, 2);
    expect(vg.map((e) => e.project_id)).toEqual(['own-vg', 'own-vg']);
    expect(vg[0].time_task_id).toBe(vg[1].time_task_id);
    expect(plan.tasks.find((t) => t.id === vg[0].time_task_id)!.name).toBe('Balatro');
    expect(plan.tags).toHaveLength(1);
    expect(vg[0].tag_ids).toEqual(vg[1].tag_ids);
    expect(plan.tasks.filter((t) => t.project_id === 'own-art').map((t) => t.name)).toEqual(['Game Art']);
    expect(plan.entries[4]).toMatchObject({ project_id: null, time_task_id: null });
    expect(plan.projects.find((p) => p.project === 'Mystery')!.target).toBeNull();
    expect(plan.timeProjects.sort()).toEqual(['own-art', 'own-vg']);
  });

  it('puts walking on its lula project, or freelance on the realm list when its project is missing', async () => {
    const plan = await planImport(
      'u',
      [old({ project: 'Walking', task: 'Park loop' }), old({ project: 'Freelance', task: 'Research and estimation' })],
      realms,
      [...own, { id: 'p-walk', area_id: 'move', name: 'Walking', is_area_default: false }],
    );
    const [walk, free] = plan.entries;
    expect(walk.project_id).toBe('p-walk');
    expect(plan.tasks.find((t) => t.id === walk.time_task_id)).toMatchObject({ name: 'Park loop', project_id: 'p-walk' });
    expect(plan.projects.find((p) => p.project === 'Walking')!.target).toBe('Move › Walking');
    expect(free.project_id).toBe('own-work');
    expect(plan.tasks.find((t) => t.id === free.time_task_id)).toMatchObject({ name: 'Freelance', project_id: 'own-work' });
    expect(free.description).toBe('Research and estimation');
  });

  it('leaves time unsorted when its realm does not exist yet', async () => {
    const plan = await planImport('u', [old({ project: 'Coding', task: 'lula' })], realms, own);
    expect(plan.entries[0].project_id).toBeNull();
    expect(plan.timeProjects).toEqual([]);
  });

  it('reads times as Eastern, or the quick app timestamps when present, and keeps ids', async () => {
    const plain = old({ start_date: '2026-01-15', start_time: '23:30:00', end_date: '2026-01-16', end_time: '00:15:00', duration_seconds: 2700 });
    const quick = old({ metadata: { quick_app: { start: '2026-09-16T18:48:06.140Z', end: '2026-09-16T18:48:14.949Z' } } });
    const plan = await planImport('u', [plain, quick], realms, own);
    expect(plan.entries[0]).toMatchObject({ id: plain.id, started_at: '2026-01-16T04:30:00.000Z', ended_at: '2026-01-16T05:15:00.000Z' });
    expect(plan.entries[1].started_at).toBe('2026-09-16T18:48:06.140Z');
    expect(plan.durationMismatches).toEqual([]);
  });

  it('gives the same ids on every run', async () => {
    const rows = [old({ project: 'Video Games', task: 'Saros', tags: ['PS5'] })];
    const a = await planImport('u', rows, realms, own);
    const b = await planImport('u', rows, realms, own);
    expect(a.tasks[0].id).toBe(b.tasks[0].id);
    expect(a.tags[0].id).toBe(b.tags[0].id);
  });
});
