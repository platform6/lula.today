// The sums behind the time Report and Entries: pure, so they can be tested and memoised.
import type { Area, Project, TimeEntry } from '../db/types';
import { dayKey } from './dates';
import { bucketOf, entrySeconds, rangeBuckets, totalsBy, weekOf, type Bucket, type DayRange } from './time';

/** The realm key for time with no realm. */
export const NO_REALM = '-';

/** The names a report needs; useTimeLookup provides them. */
export interface ReportLookup {
  areas: Map<string, Pick<Area, 'name' | 'color'>>;
  projects: Map<string, Pick<Project, 'name' | 'is_inbox' | 'is_area_default'>>;
  tasks: Map<string, { name: string }>;
  tags: Map<string, { name: string }>;
  realmOf: (projectId: string | null) => string | null;
}

/** Filter values; '' is "all". */
export interface ReportFilters {
  realm: string;
  taskId: string;
  tagId: string;
}

export const NO_FILTERS: ReportFilters = { realm: '', taskId: '', tagId: '' };

type Entry = Pick<TimeEntry, 'started_at' | 'ended_at' | 'project_id' | 'time_task_id' | 'tag_ids'>;

/** An entry counts toward the day it started on, as in Clockify. */
export const entryDay = (e: { started_at: string }) => dayKey(new Date(e.started_at));

export const realmOf = (e: Pick<Entry, 'project_id'>, lookup: ReportLookup) => lookup.realmOf(e.project_id) ?? NO_REALM;

export const realmName = (id: string, lookup: ReportLookup) =>
  id === NO_REALM ? 'No realm' : (lookup.areas.get(id)?.name ?? 'Unknown realm');

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

/**
 * A period's entries after the filters, and the choices each filter offers. Doesn't
 * depend on the clock, so it needn't rerun while a timer ticks.
 */
export function reportEntries<E extends Entry>(
  entries: E[],
  range: DayRange,
  filters: ReportFilters,
  lookup: ReportLookup,
  /** The entries are one project's: no realm filter. */
  scoped = false,
) {
  const inRange = entries.filter((e) => {
    const day = entryDay(e);
    return day >= range.from && day <= range.to;
  });
  const inRealm = scoped || !filters.realm ? inRange : inRange.filter((e) => realmOf(e, lookup) === filters.realm);
  const list = inRealm.filter(
    (e) => (!filters.taskId || e.time_task_id === filters.taskId) && (!filters.tagId || e.tag_ids.includes(filters.tagId)),
  );

  const realmOptions = [...new Set(inRange.map((e) => realmOf(e, lookup)))]
    .map((id) => ({ id, name: realmName(id, lookup) }))
    .sort(byName);
  const taskOptions = [...new Set(inRealm.map((e) => e.time_task_id).filter((id): id is string => !!id))]
    .map((id) => ({ id, name: lookup.tasks.get(id)?.name ?? 'Unknown task' }))
    .sort(byName);
  const tagOptions = [...new Set(inRange.flatMap((e) => e.tag_ids))]
    .map((id) => ({ id, name: lookup.tags.get(id)?.name ?? 'Unknown tag' }))
    .sort(byName);

  return { list, realmOptions, taskOptions, tagOptions };
}

export interface ReportTotals {
  total: number;
  bucket: Bucket;
  /** Every bucket in the range, oldest first, for the bar chart. */
  keys: string[];
  perBucket: Map<string, number>;
  realms: { key: string; name: string; color: string | null; seconds: number }[];
  /** What the breakdown groups by. */
  by: 'project' | 'task';
  /** Seconds per project or task id ('' for none), largest first. */
  breakdown: { key: string; seconds: number }[];
}

/** The totals, bars, realm slices and breakdown for a filtered list. */
export function reportTotals(
  list: Entry[],
  range: DayRange,
  lookup: ReportLookup,
  /** 'auto' groups by project when the list has more than one, else by task. */
  groupBy: 'project' | 'task' | 'auto',
  now = Date.now(),
): ReportTotals {
  const { bucket, keys } = rangeBuckets(range);
  const perBucket = new Map(totalsBy(list, (e) => bucketOf(entryDay(e), bucket), now).map((t) => [t.key, t.seconds]));
  const realms = totalsBy(list, (e) => realmOf(e, lookup), now).map((t) => ({
    ...t,
    name: realmName(t.key, lookup),
    color: lookup.areas.get(t.key)?.color ?? null,
  }));
  const by = groupBy === 'auto' ? (new Set(list.map((e) => e.project_id)).size > 1 ? 'project' : 'task') : groupBy;
  const breakdown = totalsBy(list, (e) => (by === 'task' ? (e.time_task_id ?? '') : (e.project_id ?? '')), now);
  return {
    total: list.reduce((sum, e) => sum + entrySeconds(e, now), 0),
    bucket,
    keys,
    perBucket,
    realms,
    by,
    breakdown,
  };
}

/** The JSON export: the period's entries, oldest first, with names filled in. */
export function reportExport(
  range: DayRange,
  list: (Entry & Pick<TimeEntry, 'id' | 'description'>)[],
  filters: ReportFilters,
  lookup: ReportLookup,
  now = Date.now(),
) {
  const nameOr = (map: Map<string, { name: string }>, id: string) => (id ? (map.get(id)?.name ?? null) : null);
  const entries = [...list]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((e) => {
      const p = e.project_id ? lookup.projects.get(e.project_id) : undefined;
      const realm = lookup.realmOf(e.project_id);
      return {
        id: e.id,
        started_at: e.started_at,
        ended_at: e.ended_at,
        seconds: entrySeconds(e, now),
        description: e.description,
        realm: realm ? (lookup.areas.get(realm)?.name ?? null) : null,
        project: p && !p.is_area_default && !p.is_inbox ? p.name : null,
        task: nameOr(lookup.tasks, e.time_task_id ?? ''),
        tags: e.tag_ids.map((id) => lookup.tags.get(id)?.name).filter(Boolean),
      };
    });
  return {
    from: range.from,
    to: range.to,
    filters: {
      realm: filters.realm ? realmName(filters.realm, lookup) : null,
      task: nameOr(lookup.tasks, filters.taskId),
      tag: nameOr(lookup.tags, filters.tagId),
    },
    total_seconds: entries.reduce((sum, e) => sum + e.seconds, 0),
    entries,
  };
}

/** Entries grouped by the day they started, in the order given (newest first for the Entries list). */
export function entriesByDay<E extends { started_at: string }>(entries: E[]): [string, E[]][] {
  const byDay = new Map<string, E[]>();
  for (const e of entries) {
    const day = entryDay(e);
    const list = byDay.get(day);
    if (list) list.push(e);
    else byDay.set(day, [e]);
  }
  return [...byDay];
}

/** Seconds per week, keyed by the week's Monday. */
export const weekTotals = (entries: { started_at: string; ended_at: string | null }[], now = Date.now()) =>
  new Map(totalsBy(entries, (e) => weekOf(entryDay(e)), now).map((w) => [w.key, w.seconds]));
