import { useMemo, useState } from 'react';
import { useTimeEntries } from '../db/hooks';
import { continueEntry } from '../db/time';
import type { TimeEntry } from '../db/types';
import { dayKey, todayKey, addDays } from '../lib/dates';
import { PERIOD_LABELS, entrySeconds, formatHours, periodStart, totalsBy, type Period } from '../lib/time';
import { ClockIcon, PlayIcon, PlusIcon } from './icons';
import { TimeEntrySheet } from './TimeEntrySheet';
import { TimerPicker, useNow } from './Timer';
import { useTimeLookup, type TimeLookup } from './useTimeLookup';

const PERIOD_KEY = 'lula.time.period';
const DAYS_PAGE = 14;

/**
 * Tracked time for some projects (or all of them): a period total, a breakdown
 * by task or project, and the entries day by day.
 */
export function TimeReport({
  projectIds,
  groupBy,
  startProjectId,
}: {
  /** Projects to include; omit for every entry. */
  projectIds?: string[];
  /** 'auto' groups by project when the period has more than one, else by task. */
  groupBy: 'project' | 'task' | 'auto';
  /** Project the Start and Add buttons use. */
  startProjectId?: string;
}) {
  const all = useTimeEntries();
  const lookup = useTimeLookup();
  const [period, setPeriod] = useState<Period>(() => {
    try {
      return (localStorage.getItem(PERIOD_KEY) as Period | null) ?? 'week';
    } catch {
      return 'week';
    }
  });
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [days, setDays] = useState(DAYS_PAGE);

  const ids = useMemo(() => (projectIds ? new Set(projectIds) : null), [projectIds]);
  const entries = useMemo(
    () => (all ?? []).filter((e) => !ids || (e.project_id !== null && ids.has(e.project_id))),
    [all, ids],
  );
  const running = entries.some((e) => !e.ended_at);
  const now = useNow(running, 30_000);

  if (!all || !lookup.loaded) return null;

  const from = periodStart(period)?.toISOString();
  // An entry counts toward the day and period it started in, as in Clockify.
  const inPeriod = from ? entries.filter((e) => e.started_at >= from) : entries;
  const total = inPeriod.reduce((sum, e) => sum + entrySeconds(e, now), 0);
  const by = groupBy === 'auto' ? (new Set(inPeriod.map((e) => e.project_id)).size > 1 ? 'project' : 'task') : groupBy;
  const breakdown = totalsBy(inPeriod, (e) => (by === 'task' ? (e.time_task_id ?? '') : (e.project_id ?? '')), now);
  const nameOf = (key: string) =>
    by === 'task' ? (key ? (lookup.tasks.get(key)?.name ?? 'Unknown task') : 'No task') : lookup.projectLabel(key || null);
  const colorOf = (key: string) => (by === 'project' ? lookup.projectColor(key || null) : lookup.projectColor(startProjectId ?? null));

  const byDay = new Map<string, TimeEntry[]>();
  for (const e of inPeriod) {
    const day = dayKey(new Date(e.started_at));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  const dayList = [...byDay].slice(0, days);

  const pick = (p: Period) => {
    setPeriod(p);
    setDays(DAYS_PAGE);
    try {
      localStorage.setItem(PERIOD_KEY, p);
    } catch {
      // per-viewer convenience only
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => setPicking(true)}>
          <ClockIcon /> Start timer
        </button>
        <button className="btn-outline" onClick={() => setAdding(true)}>
          <PlusIcon /> Add time
        </button>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Period">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={p === period}
            className={`min-h-10 rounded-sm border-2 px-3 text-sm font-semibold ${p === period ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
            onClick={() => pick(p)}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      <section>
        <p className="text-4xl font-bold tabular-nums">{formatHours(total)}</p>
        <p className="text-sm text-fg-2">
          {PERIOD_LABELS[period].toLowerCase()} · {inPeriod.length} entr{inPeriod.length === 1 ? 'y' : 'ies'}
        </p>
        {breakdown.length > 1 && (
          <ul className="mt-4 flex flex-col gap-2.5">
            {breakdown.map((b) => (
              <li key={b.key}>
                <div className="flex items-baseline gap-2 text-base">
                  <span className="min-w-0 flex-1 truncate font-semibold">{nameOf(b.key)}</span>
                  <span className="shrink-0 tabular-nums text-fg-2">{formatHours(b.seconds)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(2, (b.seconds / breakdown[0].seconds) * 100)}%`, background: colorOf(b.key) ?? 'var(--accent)' }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-5">
        {dayList.map(([day, list]) => (
          <DayGroup key={day} day={day} entries={list} now={now} lookup={lookup} showProject={by === 'project'} onOpen={setEditing} />
        ))}
        {inPeriod.length === 0 && <p className="text-base text-muted">No time tracked {PERIOD_LABELS[period].toLowerCase()}.</p>}
        {byDay.size > days && (
          <button className="btn-outline self-start" onClick={() => setDays((d) => d + DAYS_PAGE)}>
            Show more days
          </button>
        )}
      </section>

      {picking && <TimerPicker lookup={lookup} projectId={startProjectId} onClose={() => setPicking(false)} />}
      {adding && <TimeEntrySheet projectId={startProjectId ?? null} onClose={() => setAdding(false)} />}
      {editing && <TimeEntrySheet entry={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function dayLabel(day: string): string {
  const today = todayKey();
  if (day === today) return 'Today';
  if (day === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  });
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function DayGroup({
  day,
  entries,
  now,
  lookup,
  showProject,
  onOpen,
}: {
  day: string;
  entries: TimeEntry[];
  now: number;
  lookup: TimeLookup;
  showProject: boolean;
  onOpen: (e: TimeEntry) => void;
}) {
  const total = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
  return (
    <div>
      <h3 className="section-title">
        <span className="flex-1">{dayLabel(day)}</span>
        <span className="text-sm font-semibold tabular-nums text-fg-2">{formatHours(total)}</span>
      </h3>
      <ul className="divide-y divide-line">
        {entries.map((e) => {
          const sub = [
            showProject && e.time_task_id ? lookup.projectLabel(e.project_id) : null,
            e.description,
            e.tag_ids.map((id) => lookup.tags.get(id)?.name).filter(Boolean).join(', ') || null,
          ].filter(Boolean);
          return (
            <li key={e.id} className="flex items-center gap-2">
              <button className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 text-left" onClick={() => onOpen(e)}>
                <span
                  className="h-8 w-1.5 shrink-0 rounded-full"
                  style={{ background: lookup.projectColor(e.project_id) ?? 'var(--line-strong)' }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{lookup.entryTitle(e)}</span>
                  {sub.length > 0 && <span className="block truncate text-sm text-fg-2">{sub.join(' · ')}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span className={`block text-base font-semibold tabular-nums ${e.ended_at ? '' : 'text-accent'}`}>
                    {e.ended_at ? formatHours(entrySeconds(e, now)) : 'Running'}
                  </span>
                  <span className="block text-xs text-fg-2">
                    {clock(e.started_at)}
                    {e.ended_at ? `–${clock(e.ended_at)}` : ''}
                  </span>
                </span>
              </button>
              {e.ended_at && (
                <button className="btn-ghost shrink-0 px-2" aria-label={`Start ${lookup.entryTitle(e)} again`} onClick={() => void continueEntry(e)}>
                  <PlayIcon width={18} height={18} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
