import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTimeEntries } from '../db/hooks';
import { continueEntry, deleteEntry, restoreEntry, stopTimer } from '../db/time';
import type { TimeEntry } from '../db/types';
import { dayKey, todayKey, addDays } from '../lib/dates';
import { entrySeconds, formatDuration, stackEntries, totalsBy, weekOf } from '../lib/time';
import { ClockIcon, DownIcon, PlayIcon, PlusIcon, TagIcon } from './icons';
import { Report, remember, remembered } from './Report';
import { TimeEntrySheet } from './TimeEntrySheet';
import { TimerPicker, useNow } from './Timer';
import { useTimeLookup, type TimeLookup } from './useTimeLookup';

const VIEW_KEY = 'lula.time.view';

type View = 'entries' | 'report';
const DAYS_PAGE = 14;

/**
 * Tracked time for some projects (or all of them). Entries: every entry, week by
 * week and day by day. Report: a period's totals, charts and export.
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
  const [view, setView] = useState<View>(() => remembered<View>(VIEW_KEY, 'entries'));
  const [picking, setPicking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [days, setDays] = useState(DAYS_PAGE);
  const { remove, undoBar } = useUndoDelete(lookup);

  const ids = useMemo(() => (projectIds ? new Set(projectIds) : null), [projectIds]);
  const entries = useMemo(
    () => (all ?? []).filter((e) => !ids || (e.project_id !== null && ids.has(e.project_id))),
    [all, ids],
  );
  const running = entries.some((e) => !e.ended_at);
  const now = useNow(running, 30_000);

  if (!all || !lookup.loaded) return null;

  const byDay = new Map<string, TimeEntry[]>();
  for (const e of entries) {
    const day = dayKey(new Date(e.started_at));
    byDay.set(day, [...(byDay.get(day) ?? []), e]);
  }
  const dayList = [...byDay].slice(0, days);
  const weekTotals = new Map(totalsBy(entries, (e) => weekOf(dayKey(new Date(e.started_at))), now).map((w) => [w.key, w.seconds]));

  const show = (v: View) => {
    setView(v);
    remember(VIEW_KEY, v);
  };
  const tab = (on: boolean) =>
    `min-h-11 flex-1 rounded-sm text-base font-semibold ${on ? 'bg-surface text-fg shadow' : 'text-fg-2'}`;

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

      <div className="flex gap-1 rounded-md border border-line bg-surface-2 p-1" role="tablist" aria-label="Show">
        <button role="tab" aria-selected={view === 'entries'} className={tab(view === 'entries')} onClick={() => show('entries')}>
          Entries
        </button>
        <button role="tab" aria-selected={view === 'report'} className={tab(view === 'report')} onClick={() => show('report')}>
          Report
        </button>
      </div>

      {view === 'report' && <Report entries={entries} lookup={lookup} now={now} groupBy={groupBy} scoped={!!projectIds} />}

      {view === 'entries' && (
        <section className="flex flex-col gap-5">
          {dayList.map(([day, list], i) => {
            const week = weekOf(day);
            const newWeek = i === 0 || weekOf(dayList[i - 1][0]) !== week;
            return (
              <div key={day} className="flex flex-col gap-5">
                {newWeek && (
                  <h2 className="flex items-baseline gap-2 border-b-2 border-line-strong pb-1 text-lg font-bold">
                    <span className="flex-1">{weekLabel(week)}</span>
                    <span className="text-base tabular-nums text-fg-2">{formatDuration(weekTotals.get(week) ?? 0)}</span>
                  </h2>
                )}
                <DayGroup day={day} entries={list} now={now} lookup={lookup} onOpen={setEditing} onDelete={remove} />
              </div>
            );
          })}
          {entries.length === 0 && <p className="text-base text-muted">No time tracked yet. Start a timer or add time.</p>}
          {byDay.size > days && (
            <button className="btn-outline self-start" onClick={() => setDays((d) => d + DAYS_PAGE)}>
              Show more days
            </button>
          )}
        </section>
      )}

      {picking && <TimerPicker lookup={lookup} projectId={startProjectId} onClose={() => setPicking(false)} />}
      {adding && <TimeEntrySheet projectId={startProjectId ?? null} onClose={() => setAdding(false)} />}
      {editing && <TimeEntrySheet entry={editing} onDelete={remove} onClose={() => setEditing(null)} />}
      {undoBar}
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

function weekLabel(monday: string): string {
  const thisWeek = weekOf(todayKey());
  if (monday === thisWeek) return 'This week';
  if (monday === addDays(thisWeek, -7)) return 'Last week';
  const date = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
  return `${fmt(date(monday))} – ${fmt(date(addDays(monday, 6)))}`;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function DayGroup({
  day,
  entries,
  now,
  lookup,
  onOpen,
  onDelete,
}: {
  day: string;
  entries: TimeEntry[];
  now: number;
  lookup: TimeLookup;
  onOpen: (e: TimeEntry) => void;
  onDelete: (e: TimeEntry) => void;
}) {
  const total = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
  return (
    <div>
      <h3 className="mb-2 flex items-baseline gap-2 px-1 text-base font-semibold text-fg-2">
        <span className="flex-1">{dayLabel(day)}</span>
        <span className="tabular-nums">{formatDuration(total)}</span>
      </h3>
      <ul className="flex flex-col gap-2">
        {stackEntries(entries).map((stack) =>
          stack.length === 1 ? (
            <EntryRow key={stack[0].id} entry={stack[0]} now={now} lookup={lookup} onOpen={onOpen} onDelete={onDelete} />
          ) : (
            <EntryStack key={stack[0].id} entries={stack} now={now} lookup={lookup} onOpen={onOpen} onDelete={onDelete} />
          ),
        )}
      </ul>
    </div>
  );
}

/**
 * An entry card as in Clockify: description, then project and task, then tags;
 * duration and times on the right.
 */
function EntryBody({
  entry: e,
  seconds,
  from,
  to,
  lookup,
  showDay,
  badge,
}: {
  entry: TimeEntry;
  seconds: number;
  from: string;
  to: string | null;
  lookup: TimeLookup;
  showDay?: boolean;
  badge?: ReactNode;
}) {
  const task = e.time_task_id ? lookup.tasks.get(e.time_task_id)?.name : null;
  const tags = e.tag_ids.map((id) => lookup.tags.get(id)?.name).filter(Boolean).join(', ');
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-base ${e.description ? 'font-semibold' : 'text-muted'}`}>
          {e.description || 'No description'}
        </span>
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: lookup.projectColor(e.project_id) ?? 'var(--line-strong)' }} />
          <span className="truncate">
            <span className="font-semibold">{lookup.projectLabel(e.project_id)}{task ? ':' : ''}</span>
            {task && <span className="text-fg-2"> {task}</span>}
          </span>
        </span>
        {tags && (
          <span className="mt-1 flex min-w-0 items-center gap-1 text-xs text-fg-2">
            <TagIcon width={14} height={14} className="shrink-0" />
            <span className="truncate">{tags}</span>
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className={`text-base font-bold tabular-nums ${e.ended_at ? '' : 'text-accent'}`}>
          {e.ended_at ? formatDuration(seconds) : 'Running'}
        </span>
        <span className="text-xs text-fg-2">
          {showDay && `${dayLabel(dayKey(new Date(from)))}, `}
          {clock(from)}
          {to ? ` – ${clock(to)}` : ''}
        </span>
        {badge}
      </span>
    </>
  );
}

const cardClass = 'flex items-start gap-1 rounded-md border border-line bg-surface py-3 pr-1 pl-3';

function PlayAgain({ entry, lookup }: { entry: TimeEntry; lookup: TimeLookup }) {
  return (
    <button className="btn-ghost shrink-0 self-center px-2" aria-label={`Start ${lookup.entryTitle(entry)} again`} onClick={() => void continueEntry(entry)}>
      <PlayIcon width={18} height={18} />
    </button>
  );
}

/** One entry: tap to edit, play to start it again, swipe left to delete (finished entries). */
export function EntryRow({
  entry: e,
  now,
  lookup,
  showDay,
  onOpen,
  onDelete,
}: {
  entry: TimeEntry;
  now: number;
  lookup: TimeLookup;
  /** Show the day with the times, for lists that aren't grouped by day. */
  showDay?: boolean;
  onOpen: (e: TimeEntry) => void;
  onDelete: (e: TimeEntry) => void;
}) {
  const card = (
    <div className={cardClass}>
      <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => onOpen(e)}>
        <EntryBody entry={e} seconds={entrySeconds(e, now)} from={e.started_at} to={e.ended_at} lookup={lookup} showDay={showDay} />
      </button>
      {e.ended_at ? (
        <PlayAgain entry={e} lookup={lookup} />
      ) : (
        <button className="btn-primary min-h-11 shrink-0 self-center px-3" onClick={() => void stopTimer(e.id)}>
          Stop
        </button>
      )}
    </div>
  );
  return <li>{e.ended_at ? <SwipeToDelete onDelete={() => onDelete(e)}>{card}</SwipeToDelete> : card}</li>;
}

/** Repeats of one entry on a day, stacked behind a count; tap to show each. */
function EntryStack({
  entries,
  now,
  lookup,
  onOpen,
  onDelete,
}: {
  entries: TimeEntry[];
  now: number;
  lookup: TimeLookup;
  onOpen: (e: TimeEntry) => void;
  onDelete: (e: TimeEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const latest = entries[0];
  const seconds = entries.reduce((sum, e) => sum + entrySeconds(e, now), 0);
  const from = entries.reduce((min, e) => (e.started_at < min ? e.started_at : min), latest.started_at);
  const to = entries.reduce((max, e) => (e.ended_at && e.ended_at > max ? e.ended_at : max), latest.ended_at ?? '');

  return (
    <li>
      <div className={`relative ${cardClass}`}>
        <button className="flex min-w-0 flex-1 items-start gap-3 text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <EntryBody
            entry={latest}
            seconds={seconds}
            from={from}
            to={to || null}
            lookup={lookup}
            badge={
              <span className="mt-1.5 flex min-h-8 items-center gap-1.5 rounded-sm bg-surface-2 px-2.5 text-sm font-semibold">
                {entries.length}
                <DownIcon width={16} height={16} className={open ? 'rotate-180' : ''} />
              </span>
            }
          />
        </button>
        <PlayAgain entry={latest} lookup={lookup} />
      </div>
      {open ? (
        <ul className="mt-2 ml-3 flex flex-col gap-2 border-l-2 border-line pl-3">
          {entries.map((e) => (
            <EntryRow key={e.id} entry={e} now={now} lookup={lookup} onOpen={onOpen} onDelete={onDelete} />
          ))}
        </ul>
      ) : (
        // The edge of the cards stacked underneath.
        <div className="mx-2 h-1.5 rounded-b-md border border-t-0 border-line bg-surface-2" aria-hidden />
      )}
    </li>
  );
}

const SWIPE_DELETE = 96;

/** Swipe left (on touch) far enough and let go to delete. */
function SwipeToDelete({ onDelete, children }: { onDelete: () => void; children: ReactNode }) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const reset = () => {
    start.current = null;
    setDragging(false);
    setDx(0);
  };

  return (
    <div
      className="relative overflow-hidden rounded-md"
      style={{ touchAction: 'pan-y' }}
      onPointerDown={(ev) => {
        if (ev.pointerType !== 'touch') return;
        start.current = { x: ev.clientX, y: ev.clientY };
        swiped.current = false;
      }}
      onPointerMove={(ev) => {
        if (!start.current) return;
        const mx = ev.clientX - start.current.x;
        const my = ev.clientY - start.current.y;
        if (!dragging) {
          if (mx < -10 && Math.abs(mx) > Math.abs(my) * 1.5) {
            setDragging(true);
            swiped.current = true;
            ev.currentTarget.setPointerCapture(ev.pointerId);
          } else if (Math.abs(my) > 10 || mx > 10) {
            start.current = null;
            return;
          } else return;
        }
        setDx(Math.min(0, mx));
      }}
      onPointerUp={() => {
        if (dragging && dx <= -SWIPE_DELETE) onDelete();
        reset();
      }}
      onPointerCancel={reset}
      // The tap that ends a swipe must not also open the entry.
      onClickCapture={(ev) => {
        if (!swiped.current) return;
        ev.stopPropagation();
        ev.preventDefault();
        swiped.current = false;
      }}
    >
      {dx < 0 && (
        <div
          className={`absolute inset-0 flex items-center justify-end px-4 text-base font-bold ${dx <= -SWIPE_DELETE ? 'bg-danger text-bg' : 'bg-danger/30 text-danger'}`}
          aria-hidden
        >
          Delete
        </div>
      )}
      <div className="relative" style={{ transform: `translateX(${dx}px)`, transition: dragging ? 'none' : 'transform 150ms' }}>
        {children}
      </div>
    </div>
  );
}

/** Delete entries with a few seconds to undo. Render `undoBar` once on the page. */
export function useUndoDelete(lookup: TimeLookup) {
  const [last, setLast] = useState<TimeEntry | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const remove = (e: TimeEntry) => {
    void deleteEntry(e.id);
    clearTimeout(timer.current);
    setLast(e);
    timer.current = setTimeout(() => setLast(null), 6000);
  };
  const undo = () => {
    if (last) void restoreEntry(last.id);
    clearTimeout(timer.current);
    setLast(null);
  };

  const undoBar = last && (
    <div
      role="status"
      className="fixed right-24 bottom-[calc(8.25rem+var(--tab-safe))] left-4 z-40 flex items-center gap-3 rounded-md border-2 border-line-strong bg-surface py-2 pr-2 pl-4 shadow-2xl md:right-28 md:bottom-6 md:left-auto md:w-96"
    >
      <span className="min-w-0 flex-1 truncate text-base font-semibold">Deleted {lookup.entryTitle(last)}</span>
      <button className="btn-outline min-h-11 shrink-0 px-3" onClick={undo}>Undo</button>
    </div>
  );
  return { remove, undoBar };
}
