import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TimeEntry } from '../db/types';
import { formatDay as dayName, todayKey } from '../lib/dates';
import { reportEntries, reportExport, reportTotals, type ReportFilters } from '../lib/report';
import {
  RANGE_LABELS,
  formatDuration,
  ordered,
  rangeFor,
  rangeLabel,
  stepRange,
  type Bucket,
  type DayRange,
  type RangeKind,
} from '../lib/time';
import { remember, remembered } from '../lib/stored';
import { BackIcon, ChevronRightIcon } from './icons';
import type { TimeLookup } from './useTimeLookup';

const RANGE_KEY = 'lula.time.period';

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
  // Custom dates are kept as typed; `range` puts them in order.
  const [typed, setRange] = useState<DayRange>(() => {
    const kind = remembered<RangeKind>(RANGE_KEY, 'week');
    return rangeFor(kind in RANGE_LABELS ? kind : 'week');
  });
  const [realm, setRealm] = useState('');
  const [taskId, setTaskId] = useState('');
  const [tagId, setTagId] = useState('');
  const { kind, from, to } = ordered(typed);
  const range = useMemo(() => ({ kind, from, to }), [kind, from, to]);
  const filters: ReportFilters = useMemo(() => ({ realm, taskId, tagId }), [realm, taskId, tagId]);

  const today = todayKey();
  // Filtering waits for the period or a filter to change; the totals follow the running clock.
  const { list, realmOptions, taskOptions, tagOptions } = useMemo(
    () => reportEntries(entries, range, filters, lookup, scoped),
    [entries, range, filters, lookup, scoped],
  );
  const { total, bucket, keys, perBucket, realms, by, breakdown } = useMemo(
    () => reportTotals(list, range, lookup, groupBy, now),
    [list, range, lookup, groupBy, now],
  );
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
            <DateInput label="From" value={typed.from} onChange={(from) => setRange({ ...typed, from })} />
            <DateInput label="To" value={typed.to} onChange={(to) => setRange({ ...typed, to })} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {!scoped && (
          <Filter label="Realm" value={realm} onChange={(v) => { setRealm(v); setTaskId(''); }} all="All realms">
            {realmOptions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
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
          <button className="btn-outline min-h-11" disabled={list.length === 0} onClick={() => downloadJson(range, reportExport(range, list, filters, lookup, now))}>
            Export JSON
          </button>
        </div>

        {list.length === 0 ? (
          <p className="text-base text-muted">No time tracked in this period{filtered ? ' with these filters' : ''}.</p>
        ) : (
          <>
            <Bars bucket={bucket} keys={keys} seconds={perBucket} />
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

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

/**
 * A date typed in a part at a time passes through years like 0002 and 0020; only a
 * whole, likely date reaches the report, so typing a year isn't held up.
 */
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input
        type="date"
        className="input w-auto"
        min={`${MIN_YEAR}-01-01`}
        max={`${MAX_YEAR}-12-31`}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          setDraft(v);
          const year = Number(v.slice(0, 4));
          if (v && year >= MIN_YEAR && year <= MAX_YEAR) onChange(v);
        }}
        // Leaving a half-typed date puts back the last whole one.
        onBlur={() => setDraft(value)}
      />
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

const BUCKET_NAME: Record<Bucket, (key: string) => string> = {
  day: (d) => dayName(d, { weekday: 'short', month: 'short', day: 'numeric' }),
  week: (d) => `Week of ${dayName(d, { month: 'short', day: 'numeric', year: 'numeric' })}`,
  month: (d) => dayName(d, { month: 'long', year: 'numeric' }),
};

/** Under each bar: weekdays for a week or two, else a label every few bars. */
function tick(key: string, i: number, count: number, bucket: Bucket): string {
  if (bucket === 'day' && count <= 14) return dayName(key, { weekday: 'narrow' });
  if (i % Math.ceil(count / 8) !== 0) return '';
  if (bucket === 'day') return dayName(key, { day: 'numeric' });
  if (bucket === 'week') return dayName(key, { month: 'short', day: 'numeric' });
  return dayName(key, { month: 'short', year: '2-digit' });
}

/** Hours per day (a week or a month for long ranges); tap or hover a bar to read its total. */
function Bars({ bucket, keys, seconds }: { bucket: Bucket; keys: string[]; seconds: Map<string, number> }) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(1, ...keys.map((d) => seconds.get(d) ?? 0));
  const peak = keys.find((d) => (seconds.get(d) ?? 0) === max);
  const read = active ?? peak;

  return (
    <figure>
      <figcaption className="flex items-baseline gap-2">
        <h3 className="section-title flex-1">Hours per {bucket}</h3>
        {read && (
          <span className="text-sm text-fg-2">
            {active ? '' : 'Most: '}
            {BUCKET_NAME[bucket](read)} ·{' '}
            <span className="font-semibold text-fg tabular-nums">{formatDuration(seconds.get(read) ?? 0)}</span>
          </span>
        )}
      </figcaption>
      <div className="mt-2 flex h-40 items-end gap-0.5 border-b border-line-strong" onMouseLeave={() => setActive(null)}>
        {keys.map((d) => {
          const s = seconds.get(d) ?? 0;
          return (
            <button
              key={d}
              className="flex h-full min-w-0 flex-1 items-end"
              aria-label={`${BUCKET_NAME[bucket](d)}: ${formatDuration(s)}`}
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
        {keys.map((d, i) => (
          <span key={d} className="min-w-0 flex-1 overflow-visible text-center whitespace-nowrap">
            {tick(d, i, keys.length, bucket)}
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

/** Download the export as a JSON file. */
function downloadJson(range: DayRange, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `lula-time-${range.from}-to-${range.to}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
