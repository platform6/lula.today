import { useState, type ReactNode } from 'react';
import type { TimeEntry } from '../db/types';
import { dayKey, todayKey } from '../lib/dates';
import {
  RANGE_LABELS,
  entrySeconds,
  formatDuration,
  rangeDays,
  rangeFor,
  rangeLabel,
  stepRange,
  totalsBy,
  type DayRange,
  type RangeKind,
} from '../lib/time';
import { BackIcon, ChevronRightIcon } from './icons';
import type { TimeLookup } from './useTimeLookup';

const RANGE_KEY = 'lula.time.period';
/** The realm key for time with no realm. */
const NO_REALM = '-';

export function remembered<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

export function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // per-viewer convenience only
  }
}

const dayName = (day: string, opts: Intl.DateTimeFormatOptions) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
};

/**
 * A period's tracked time: total, hours per day, time by realm, and a breakdown
 * by project or task. Filter by realm, task and tag; step with < >; export as JSON.
 */
export function Report({
  entries,
  lookup,
  now,
  groupBy,
  scoped,
}: {
  entries: TimeEntry[];
  lookup: TimeLookup;
  now: number;
  /** 'auto' groups by project when the period has more than one, else by task. */
  groupBy: 'project' | 'task' | 'auto';
  /** The entries are one project's: no realm filter or realm chart. */
  scoped: boolean;
}) {
  const [range, setRange] = useState<DayRange>(() => {
    const kind = remembered<RangeKind>(RANGE_KEY, 'week');
    return rangeFor(kind in RANGE_LABELS ? kind : 'week');
  });
  const [realm, setRealm] = useState('');
  const [taskId, setTaskId] = useState('');
  const [tagId, setTagId] = useState('');

  const today = todayKey();
  const realmOf = (e: TimeEntry) => {
    const p = e.project_id ? lookup.projects.get(e.project_id) : undefined;
    return (p && !p.is_inbox && p.area_id) || NO_REALM;
  };
  const realmName = (id: string) => (id === NO_REALM ? 'No realm' : (lookup.areas.get(id)?.name ?? 'Unknown realm'));

  // An entry counts toward the day it started on, as in Clockify.
  const inRange = entries.filter((e) => {
    const day = dayKey(new Date(e.started_at));
    return day >= range.from && day <= range.to;
  });
  const inRealm = scoped || !realm ? inRange : inRange.filter((e) => realmOf(e) === realm);
  const list = inRealm.filter((e) => (!taskId || e.time_task_id === taskId) && (!tagId || e.tag_ids.includes(tagId)));
  const total = list.reduce((sum, e) => sum + entrySeconds(e, now), 0);

  const realmOptions = [...new Set(inRange.map(realmOf))].sort((a, b) => realmName(a).localeCompare(realmName(b)));
  const taskOptions = [...new Set(inRealm.map((e) => e.time_task_id).filter((id): id is string => !!id))]
    .map((id) => ({ id, name: lookup.tasks.get(id)?.name ?? 'Unknown task' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const tagOptions = [...new Set(inRange.flatMap((e) => e.tag_ids))]
    .map((id) => ({ id, name: lookup.tags.get(id)?.name ?? 'Unknown tag' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const days = rangeDays(range);
  const perDay = new Map(totalsBy(list, (e) => dayKey(new Date(e.started_at)), now).map((t) => [t.key, t.seconds]));
  const realms = totalsBy(list, realmOf, now).map((t) => ({
    ...t,
    name: realmName(t.key),
    color: lookup.areas.get(t.key)?.color ?? null,
  }));
  const by = groupBy === 'auto' ? (new Set(list.map((e) => e.project_id)).size > 1 ? 'project' : 'task') : groupBy;
  const breakdown = totalsBy(list, (e) => (by === 'task' ? (e.time_task_id ?? '') : (e.project_id ?? '')), now);
  const nameOf = (key: string) =>
    by === 'task' ? (key ? (lookup.tasks.get(key)?.name ?? 'Unknown task') : 'No task') : lookup.projectLabel(key || null);

  const pick = (kind: RangeKind) => {
    // Custom starts from the dates on screen.
    setRange(kind === 'custom' ? { ...range, kind } : rangeFor(kind, today));
    remember(RANGE_KEY, kind);
  };
  const filtered = !!(realm || taskId || tagId);

  return (
    <>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {(Object.keys(RANGE_LABELS) as RangeKind[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={k === range.kind}
            className={`min-h-11 rounded-sm border-2 px-3 text-sm font-semibold ${k === range.kind ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
            onClick={() => pick(k)}
          >
            {RANGE_LABELS[k]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-outline min-h-11 shrink-0 px-2" aria-label="Previous period" onClick={() => setRange(stepRange(range, -1))}>
            <BackIcon />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-center text-lg font-bold">{rangeLabel(range, today)}</h2>
          <button
            className="btn-outline min-h-11 shrink-0 px-2"
            aria-label="Next period"
            disabled={range.to >= today}
            onClick={() => setRange(stepRange(range, 1))}
          >
            <ChevronRightIcon />
          </button>
        </div>
        {range.kind === 'custom' && (
          <div className="flex flex-wrap gap-2">
            <DateInput label="From" value={range.from} onChange={(from) => setRange({ ...range, from, to: from > range.to ? from : range.to })} />
            <DateInput label="To" value={range.to} onChange={(to) => setRange({ ...range, to, from: to < range.from ? to : range.from })} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!scoped && (
          <Filter label="Realm" value={realm} onChange={(v) => { setRealm(v); setTaskId(''); }} all="All realms">
            {realmOptions.map((id) => <option key={id} value={id}>{realmName(id)}</option>)}
          </Filter>
        )}
        <Filter label="Task" value={taskId} onChange={setTaskId} all="All tasks">
          {taskOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Filter>
        <Filter label="Tag" value={tagId} onChange={setTagId} all="All tags">
          {tagOptions.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Filter>
        {filtered && (
          <button className="btn-ghost min-h-11 self-end" onClick={() => { setRealm(''); setTaskId(''); setTagId(''); }}>
            Clear filters
          </button>
        )}
      </div>

      <section className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1">
            <p className="text-4xl font-bold tabular-nums">{formatDuration(total)}</p>
            <p className="text-sm text-fg-2">
              {list.length} entr{list.length === 1 ? 'y' : 'ies'}
              {filtered ? ' (filtered)' : ''}
            </p>
          </div>
          <button className="btn-outline min-h-11" disabled={list.length === 0} onClick={() => exportJson(range, list, lookup, now, { realm, taskId, tagId })}>
            Export JSON
          </button>
        </div>

        {list.length === 0 ? (
          <p className="text-base text-muted">No time tracked in this period{filtered ? ' with these filters' : ''}.</p>
        ) : (
          <>
            <DayBars days={days} seconds={perDay} />
            {!scoped && <RealmDonut slices={realms} total={total} />}
            {breakdown.length > 1 && (
              <div>
                <h3 className="section-title mb-2">By {by}</h3>
                <ul className="flex flex-col gap-2.5">
                  {breakdown.map((b) => (
                    <li key={b.key}>
                      <div className="flex items-baseline gap-2 text-base">
                        <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(b.key)}</span>
                        <span className="shrink-0 tabular-nums text-fg-2">{formatDuration(b.seconds)}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(2, (b.seconds / breakdown[0].seconds) * 100)}%`,
                            background: (by === 'project' && lookup.projectColor(b.key || null)) || 'var(--accent)',
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input type="date" className="input w-auto" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </label>
  );
}

function Filter({
  label,
  value,
  onChange,
  all,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  all: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-36 flex-1 flex-col gap-1 text-sm font-semibold">
      {label}
      <select className="input min-h-11" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {children}
      </select>
    </label>
  );
}

/** Hours per day: one bar a day; tap or hover a bar to read its total. */
function DayBars({ days, seconds }: { days: string[]; seconds: Map<string, number> }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...days.map((d) => seconds.get(d) ?? 0));
  const peak = days.find((d) => (seconds.get(d) ?? 0) === max);
  const short = days.length <= 14;
  const read = active ?? peak;

  return (
    <figure>
      <figcaption className="flex items-baseline gap-2">
        <h3 className="section-title flex-1">Hours per day</h3>
        {read && (
          <span className="text-sm text-fg-2">
            {active ? '' : 'Most: '}
            {dayName(read, { weekday: 'short', month: 'short', day: 'numeric' })} ·{' '}
            <span className="font-semibold text-fg tabular-nums">{formatDuration(seconds.get(read) ?? 0)}</span>
          </span>
        )}
      </figcaption>
      <div className="mt-2 flex h-40 items-end gap-0.5 border-b border-line-strong" onMouseLeave={() => setActive(null)}>
        {days.map((d) => {
          const s = seconds.get(d) ?? 0;
          return (
            <button
              key={d}
              className="flex h-full min-w-0 flex-1 items-end"
              aria-label={`${dayName(d, { weekday: 'long', month: 'long', day: 'numeric' })}: ${formatDuration(s)}`}
              aria-pressed={active === d}
              onMouseEnter={() => setActive(d)}
              onFocus={() => setActive(d)}
              onBlur={() => setActive(null)}
              onClick={() => setActive((a) => (a === d ? null : d))}
            >
              <span
                className={`block w-full rounded-t-[4px] ${active && active !== d ? 'bg-accent/50' : 'bg-accent'}`}
                style={{ height: s ? `max(2px, ${(s / max) * 100}%)` : 0 }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-0.5 text-xs text-fg-2" aria-hidden>
        {days.map((d, i) => (
          <span key={d} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {short ? dayName(d, { weekday: 'narrow' }) : i % 7 === 0 ? dayName(d, { day: 'numeric' }) : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}

const R = 60;
const STROKE = 22;
const C = 2 * Math.PI * R;
const GAP = 2;

/** Time by realm: a donut in each realm's color, with every realm's total beside it. */
function RealmDonut({ slices, total }: { slices: { key: string; name: string; color: string | null; seconds: number }[]; total: number }) {
  let start = 0;
  const gap = slices.length > 1 ? GAP : 0;
  return (
    <figure className="flex flex-wrap items-center gap-6">
      <svg viewBox="0 0 160 160" className="h-40 w-40 shrink-0" role="img" aria-label="Time by realm">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--surface-2)" strokeWidth={STROKE} />
        {slices.map((s) => {
          const length = (s.seconds / total) * C;
          const arc = (
            <circle
              key={s.key}
              cx="80"
              cy="80"
              r={R}
              fill="none"
              stroke={s.color ?? 'var(--line-strong)'}
              strokeWidth={STROKE}
              strokeDasharray={`${Math.max(0, length - gap)} ${C}`}
              strokeDashoffset={-start}
              transform="rotate(-90 80 80)"
            >
              <title>{`${s.name}: ${formatDuration(s.seconds)}`}</title>
            </circle>
          );
          start += length;
          return arc;
        })}
      </svg>
      <figcaption className="min-w-48 flex-1">
        <h3 className="section-title mb-2">By realm</h3>
        <ul className="flex flex-col gap-2">
          {slices.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-base">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color ?? 'var(--line-strong)' }} />
              <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
              <span className="shrink-0 tabular-nums text-fg-2">{formatDuration(s.seconds)}</span>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-fg-2">{Math.round((s.seconds / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

/** Download the period's entries, with names filled in, as a JSON file. */
function exportJson(
  range: DayRange,
  list: TimeEntry[],
  lookup: TimeLookup,
  now: number,
  filters: { realm: string; taskId: string; tagId: string },
) {
  const nameOr = <T extends { name: string }>(map: Map<string, T>, id: string) => (id ? (map.get(id)?.name ?? null) : null);
  const entries = [...list]
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
    .map((e) => {
      const p = e.project_id ? lookup.projects.get(e.project_id) : undefined;
      return {
        id: e.id,
        started_at: e.started_at,
        ended_at: e.ended_at,
        seconds: entrySeconds(e, now),
        description: e.description,
        realm: p?.area_id ? (lookup.areas.get(p.area_id)?.name ?? null) : null,
        project: p && !p.is_area_default && !p.is_inbox ? p.name : null,
        task: nameOr(lookup.tasks, e.time_task_id ?? ''),
        tags: e.tag_ids.map((id) => lookup.tags.get(id)?.name).filter(Boolean),
      };
    });
  const data = {
    from: range.from,
    to: range.to,
    filters: {
      realm: nameOr(lookup.areas, filters.realm),
      task: nameOr(lookup.tasks, filters.taskId),
      tag: nameOr(lookup.tags, filters.tagId),
    },
    total_seconds: entries.reduce((sum, e) => sum + e.seconds, 0),
    entries,
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lula-time-${range.from}-to-${range.to}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
