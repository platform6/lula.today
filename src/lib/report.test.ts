import { describe, expect, it } from 'vitest';
import { NO_FILTERS, NO_REALM, entriesByDay, realmOf, reportEntries, reportExport, reportTotals, weekTotals, type ReportLookup } from './report';
import type { Area, Project } from '../db/types';
import { placeOf } from './paths';
import type { DayRange } from './time';

// Local times (no Z), so the day an entry falls on doesn't depend on the test machine's zone.
const at = (day: string, hours: number) => {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, 0, hours * 60).toISOString();
};

let n = 0;
const entry = (
  day: string,
  from: number,
  to: number | null,
  more: { project_id?: string | null; time_task_id?: string | null; tag_ids?: string[]; description?: string } = {},
) => ({
  id: `e${++n}`,
  started_at: at(day, from),
  ended_at: to === null ? null : at(day, to),
  project_id: 'site',
  time_task_id: null,
  tag_ids: [],
  description: '',
  ...more,
});

const areas = new Map([
  ['work', { id: 'work', name: 'Work', color: '#0a0' }],
  ['home', { id: 'home', name: 'Home', color: null }],
]);
const projects = new Map([
  ['site', { id: 'site', name: 'Site', area_id: 'work', is_inbox: false, is_area_default: false, color: null }],
  ['admin', { id: 'admin', name: 'Work', area_id: 'work', is_inbox: false, is_area_default: true, color: null }],
  ['garden', { id: 'garden', name: 'Garden', area_id: 'home', is_inbox: false, is_area_default: false, color: null }],
  ['inbox', { id: 'inbox', name: 'Sorting', area_id: 'work', is_inbox: true, is_area_default: false, color: null }],
]);

// As useTimeLookup does it: the realm comes from placeOf.
const lookup: ReportLookup = {
  areas,
  projects,
  realmOf: (id) =>
    placeOf((id ? projects.get(id) : undefined) as Project | undefined, areas as unknown as Map<string, Area>)?.area?.id ?? null,
  tasks: new Map([
    ['design', { name: 'Design' }],
    ['build', { name: 'Build' }],
  ]),
  tags: new Map([['billable', { name: 'Billable' }]]),
};

const week: DayRange = { kind: 'week', from: '2026-10-19', to: '2026-10-25' };

const entries = [
  entry('2026-10-26', 9, 10), // next week
  entry('2026-10-22', 9, 11, { time_task_id: 'design', tag_ids: ['billable'] }),
  entry('2026-10-22', 13, 14, { time_task_id: 'build' }),
  entry('2026-10-20', 8, 9, { project_id: 'garden' }),
  entry('2026-10-19', 10, 10.5, { project_id: 'inbox' }),
  entry('2026-10-18', 9, 17), // last week
];

describe('realmOf', () => {
  it("is the project's realm; Sorting and no project have none", () => {
    expect(realmOf(entries[1], lookup)).toBe('work');
    expect(realmOf(entries[3], lookup)).toBe('home');
    expect(realmOf(entries[4], lookup)).toBe(NO_REALM);
    expect(realmOf(entry('2026-10-20', 1, 2, { project_id: null }), lookup)).toBe(NO_REALM);
  });
});

describe('reportEntries', () => {
  it('keeps the entries started in the range', () => {
    const { list } = reportEntries(entries, week, NO_FILTERS, lookup);
    expect(list).toEqual(entries.slice(1, 5));
  });

  it('filters by realm, task and tag, and offers the choices in the range', () => {
    const r = reportEntries(entries, week, { ...NO_FILTERS, realm: 'work' }, lookup);
    expect(r.list).toEqual(entries.slice(1, 3));
    expect(r.realmOptions).toEqual([
      { id: 'home', name: 'Home' },
      { id: NO_REALM, name: 'No realm' },
      { id: 'work', name: 'Work' },
    ]);
    expect(r.taskOptions.map((t) => t.name)).toEqual(['Build', 'Design']);
    expect(r.tagOptions).toEqual([{ id: 'billable', name: 'Billable' }]);

    expect(reportEntries(entries, week, { ...NO_FILTERS, realm: NO_REALM }, lookup).list).toEqual([entries[4]]);
    expect(reportEntries(entries, week, { ...NO_FILTERS, taskId: 'build' }, lookup).list).toEqual([entries[2]]);
    expect(reportEntries(entries, week, { ...NO_FILTERS, tagId: 'billable' }, lookup).list).toEqual([entries[1]]);
  });

  it('only offers the tasks in the chosen realm', () => {
    const r = reportEntries(entries, week, { ...NO_FILTERS, realm: 'home' }, lookup);
    expect(r.taskOptions).toEqual([]);
  });

  it("ignores the realm filter for one project's report", () => {
    const { list } = reportEntries(entries, week, { ...NO_FILTERS, realm: 'home' }, lookup, true);
    expect(list).toHaveLength(4);
  });
});

describe('reportTotals', () => {
  const { list } = reportEntries(entries, week, NO_FILTERS, lookup);

  it('totals the period, by day and by realm', () => {
    const t = reportTotals(list, week, lookup, 'auto');
    expect(t.total).toBe(4.5 * 3600);
    expect(t.bucket).toBe('day');
    expect(t.keys).toHaveLength(7);
    expect(t.perBucket.get('2026-10-22')).toBe(3 * 3600);
    expect(t.perBucket.get('2026-10-21')).toBeUndefined();
    expect(t.realms).toEqual([
      { key: 'work', name: 'Work', color: '#0a0', seconds: 3 * 3600 },
      { key: 'home', name: 'Home', color: null, seconds: 3600 },
      { key: NO_REALM, name: 'No realm', color: null, seconds: 1800 },
    ]);
  });

  it('breaks down by project when there are several, else by task', () => {
    const several = reportTotals(list, week, lookup, 'auto');
    expect(several.by).toBe('project');
    expect(several.breakdown[0]).toEqual({ key: 'site', seconds: 3 * 3600 });

    const one = reportTotals(list.slice(0, 2), week, lookup, 'auto');
    expect(one.by).toBe('task');
    expect(one.breakdown).toEqual([
      { key: 'design', seconds: 2 * 3600 },
      { key: 'build', seconds: 3600 },
    ]);
  });

  it('counts a running entry up to now', () => {
    const running = entry('2026-10-23', 9, null);
    const now = Date.parse(at('2026-10-23', 9.5));
    expect(reportTotals([running], week, lookup, 'task', now).total).toBe(1800);
  });
});

describe('reportExport', () => {
  it('lists the entries oldest first, with names', () => {
    const { list } = reportEntries(entries, week, { ...NO_FILTERS, realm: 'work' }, lookup);
    const data = reportExport(week, [...list, entry('2026-10-21', 9, 10, { project_id: 'admin' })], { ...NO_FILTERS, realm: 'work' }, lookup);
    expect(data.from).toBe('2026-10-19');
    expect(data.filters).toEqual({ realm: 'Work', task: null, tag: null });
    expect(data.total_seconds).toBe(4 * 3600);
    expect(data.entries.map((e) => e.task)).toEqual([null, 'Design', 'Build']);
    // A realm's own list has no project name.
    expect(data.entries[0]).toMatchObject({ realm: 'Work', project: null, seconds: 3600 });
    expect(data.entries[1]).toMatchObject({ project: 'Site', tags: ['Billable'] });
  });

  it('names the No realm filter', () => {
    expect(reportExport(week, [], { ...NO_FILTERS, realm: NO_REALM }, lookup).filters.realm).toBe('No realm');
  });
});

describe('entries by day and week', () => {
  it('groups by start day in the order given', () => {
    const days = entriesByDay(entries);
    expect(days.map(([d]) => d)).toEqual(['2026-10-26', '2026-10-22', '2026-10-20', '2026-10-19', '2026-10-18']);
    expect(days[1][1]).toEqual(entries.slice(1, 3));
  });

  it('totals each week from its Monday', () => {
    const weeks = weekTotals(entries);
    expect(weeks.get('2026-10-26')).toBe(3600);
    expect(weeks.get('2026-10-19')).toBe(4.5 * 3600);
    expect(weeks.get('2026-10-12')).toBe(8 * 3600);
  });
});
