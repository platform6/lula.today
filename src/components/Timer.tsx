import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject, useRunningEntry, useTimeEntries } from '../db/hooks';
import { continueEntry, ensureTimeTask, startCardTimer, startTimer, stopTimer, updateEntry } from '../db/time';
import type { Task, TimeEntry } from '../db/types';
import { tracksTime } from '../lib/paths';
import { dayKey } from '../lib/dates';
import { entrySeconds, formatClock, formatHours, nameKey, runningLong, timesProblem } from '../lib/time';
import { ClockIcon, PlusIcon } from './icons';
import { Sheet } from './Sheet';
import { TimeEntrySheet } from './TimeEntrySheet';
import { useTimeLookup, type TimeLookup } from './useTimeLookup';

/** The current time, updated every `ms` while `active`. */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [active, ms]);
  return now;
}

/**
 * One tap to start, see or stop the timer. Docked above the tabs on phones, in the
 * sidebar on wide screens, and at the top of the Time page on phones ('inline',
 * shown only while a timer runs, since that page has its own Start timer).
 */
export function TimerBar({ variant }: { variant: 'dock' | 'side' | 'inline' }) {
  const running = useRunningEntry();
  const lookup = useTimeLookup();
  const now = useNow(!!running);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const [stoppingAt, setStoppingAt] = useState(false);

  if (running === undefined || !lookup.loaded || (variant === 'inline' && !running)) return null;

  const shell =
    variant === 'dock'
      ? 'fixed inset-x-0 bottom-[calc(4rem+var(--tab-safe))] z-20 flex h-14 items-center gap-2 border-t border-line bg-surface px-3 md:hidden'
      : 'mx-2 flex min-h-14 items-center gap-2 rounded-md border border-line bg-surface-2 px-2';

  // A running timer is the loudest thing on screen: tinted, with a big live clock.
  const long = !!running && runningLong(running, now);
  const tint = long ? 'border-warn bg-warn/15' : 'border-accent bg-accent/15';
  const runningShell =
    variant === 'dock'
      ? `fixed inset-x-0 bottom-[calc(4rem+var(--tab-safe))] z-20 flex h-14 items-center gap-2 border-t-2 px-3 md:hidden ${tint}`
      : `${variant === 'inline' ? 'mx-4 mt-4 md:hidden' : 'mx-2'} flex flex-col gap-2 rounded-md border-2 p-2 ${tint}`;
  const clockSize = variant === 'dock' ? 'text-xl' : variant === 'inline' ? 'text-4xl' : 'text-2xl';

  const title = running && (
    <button className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight" onClick={() => setEditing(true)}>
      <span className="w-full truncate text-base font-bold">{lookup.entryTitle(running)}</span>
      <span className={`w-full truncate text-xs font-semibold ${long ? 'text-warn' : 'text-fg-2'}`}>
        {long
          ? `Running since ${since(running.started_at)}`
          : running.time_task_id
            ? lookup.projectLabel(running.project_id)
            : running.description || 'Tap to edit'}
      </span>
    </button>
  );
  const clock = running && (
    <span className={`shrink-0 font-mono font-bold tabular-nums ${clockSize}`} role="timer">
      {formatClock(entrySeconds(running, now))}
    </span>
  );
  // A timer left on offers Stop at… (when it really ended); otherwise Switch to something else.
  const actions = running && (
    <>
      {long ? (
        <button className="btn-outline min-h-11 shrink-0 px-3" onClick={() => setStoppingAt(true)}>Stop at…</button>
      ) : (
        <button className="btn-outline min-h-11 shrink-0 px-3" onClick={() => setPicking(true)}>Switch</button>
      )}
      <button className="btn-primary min-h-11 shrink-0 px-3" onClick={() => void stopTimer(running.id)}>
        Stop
      </button>
    </>
  );

  return (
    <>
      {running ? (
        variant === 'dock' ? (
          <div className={runningShell}>
            {title}
            {clock}
            {actions}
          </div>
        ) : (
          <div className={runningShell}>
            <div className="flex items-center gap-2">
              {title}
              {clock}
            </div>
            <div className="flex justify-end gap-2">{actions}</div>
          </div>
        )
      ) : (
        <div className={shell}>
          <button className="btn-ghost min-h-10 flex-1 justify-start px-2 text-fg" onClick={() => setPicking(true)}>
            <ClockIcon /> Start timer
          </button>
          <Link to="/" className="btn-ghost min-h-10 shrink-0 px-2 text-sm">
            Time
          </Link>
        </div>
      )}
      {picking && <TimerPicker lookup={lookup} onClose={() => setPicking(false)} />}
      {editing && running && <TimeEntrySheet entry={running} onClose={() => setEditing(false)} />}
      {stoppingAt && running && <StopAtSheet entry={running} onClose={() => setStoppingAt(false)} />}
    </>
  );
}

/** "5:12 PM", or "Mon 5:12 PM" when it's not today. */
function since(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return dayKey(d) === dayKey(new Date()) ? time : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Stop a timer that was left on, at the time it really ended. */
function StopAtSheet({ entry, onClose }: { entry: TimeEntry; onClose: () => void }) {
  // Start from an hour after it began, the likeliest kind of "forgot to stop".
  const guess = new Date(Math.min(Date.parse(entry.started_at) + 3600_000, Date.now()));
  const [date, setDate] = useState(dayKey(guess));
  const [time, setTime] = useState(`${pad(guess.getHours())}:${pad(guess.getMinutes())}`);
  const [error, setError] = useState<string | null>(null);

  async function stop() {
    const ended_at = new Date(`${date}T${time}`).toISOString();
    const problem = timesProblem(entry.started_at, ended_at);
    if (problem) return setError(problem);
    await updateEntry(entry.id, { ended_at });
    onClose();
  }

  return (
    <Sheet
      title="Stop at…"
      onClose={onClose}
      side="center"
      footer={
        <div className="flex w-full justify-end gap-2 pb-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => void stop()}>Stop</button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <p className="text-base text-fg-2">Started {since(entry.started_at)}. When did you finish?</p>
        <div className="flex flex-wrap gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Date
            <input
              type="date"
              className="input w-auto"
              value={date}
              min={dayKey(new Date(entry.started_at))}
              max={dayKey(new Date())}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Time
            <input type="time" className="input w-auto" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
          </label>
        </div>
        {error && <p className="text-base font-semibold text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}

type Recent = { project_id: string | null; time_task_id: string | null; entry: TimeEntry };

/** Recent project and task pairs, newest first. */
function recentPairs(entries: TimeEntry[], limit: number): Recent[] {
  const seen = new Set<string>();
  const out: Recent[] = [];
  for (const e of entries) {
    const key = `${e.project_id}|${e.time_task_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ project_id: e.project_id, time_task_id: e.time_task_id, entry: e });
    if (out.length === limit) break;
  }
  return out;
}

/** Pick what to track: a recent pair, a task, a project, or a new task typed in. */
export function TimerPicker({ lookup, onClose, projectId }: { lookup: TimeLookup; onClose: () => void; projectId?: string }) {
  const entries = useTimeEntries();
  const [query, setQuery] = useState('');
  const [newIn, setNewIn] = useState(projectId ?? lookup.timeProjects[0]?.id ?? '');
  const key = nameKey(query);

  const recent = useMemo(
    () => recentPairs((entries ?? []).filter((e) => !projectId || e.project_id === projectId), 6),
    [entries, projectId],
  );
  const projects = lookup.timeProjects.filter((p) => !projectId || p.id === projectId);
  const matchingProjects = key ? projects.filter((p) => nameKey(lookup.projectLabel(p.id)).includes(key)) : projects;
  const matchingTasks = key
    ? projects.flatMap((p) => lookup.tasksOf(p.id).filter((t) => nameKey(t.name).includes(key)))
    : [];
  const exact = matchingTasks.some((t) => t.project_id === newIn && nameKey(t.name) === key);

  const start = async (input: { project_id: string | null; time_task_id?: string | null }) => {
    await startTimer(input);
    onClose();
  };
  const startNew = async () => {
    const task = await ensureTimeTask(newIn || null, query);
    await start({ project_id: newIn || null, time_task_id: task.id });
  };

  const row = 'flex min-h-12 w-full items-center gap-3 rounded-sm px-3 text-left hover:bg-surface-2';
  const dot = (projectId: string | null) => (
    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: lookup.projectColor(projectId) ?? 'var(--line-strong)' }} />
  );

  return (
    <Sheet title="Start timer" onClose={onClose} side="center">
      <div className="flex flex-col gap-4 p-4">
        <input
          autoFocus
          className="input"
          placeholder="Search or type a new task"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="go"
        />

        {!key && recent.length > 0 && (
          <section>
            <h2 className="kicker mb-1">Recent</h2>
            {recent.map((r) => (
              <button key={r.entry.id} className={row} onClick={() => void continueEntry(r.entry).then(onClose)}>
                {dot(r.project_id)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{lookup.entryTitle(r.entry)}</span>
                  {r.time_task_id && <span className="block truncate text-sm text-fg-2">{lookup.projectLabel(r.project_id)}</span>}
                </span>
              </button>
            ))}
          </section>
        )}

        {matchingTasks.length > 0 && (
          <section>
            <h2 className="kicker mb-1">Tasks</h2>
            {matchingTasks.slice(0, 30).map((t) => (
              <button key={t.id} className={row} onClick={() => void start({ project_id: t.project_id, time_task_id: t.id })}>
                {dot(t.project_id)}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{t.name}</span>
                  <span className="block truncate text-sm text-fg-2">{lookup.projectLabel(t.project_id)}</span>
                </span>
              </button>
            ))}
          </section>
        )}

        {matchingProjects.length > 0 && (
          <section>
            <h2 className="kicker mb-1">Projects</h2>
            {matchingProjects.map((p) => (
              <button key={p.id} className={row} onClick={() => void start({ project_id: p.id })}>
                {dot(p.id)}
                <span className="truncate text-base font-semibold">{lookup.projectLabel(p.id)}</span>
              </button>
            ))}
          </section>
        )}

        {key && !exact && (
          <section className="card flex flex-col gap-2 p-3">
            <p className="text-base">
              New task <b>“{query.trim()}”</b> in
            </p>
            <select className="input" value={newIn} onChange={(e) => setNewIn(e.target.value)} aria-label="Project for the new task">
              <option value="">No project</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{lookup.projectLabel(p.id)}</option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => void startNew()}>
              <PlusIcon /> Start
            </button>
          </section>
        )}

        {lookup.timeProjects.length === 0 && (
          <p className="text-base text-fg-2">
            No project tracks time yet. Tick <b>Time tracking</b> in a realm’s or project’s options to pick it here.
          </p>
        )}
        {!key && (
          <button className="btn-ghost self-start" onClick={() => void start({ project_id: projectId ?? null })}>
            Start without {projectId ? 'a task' : 'a project'}
          </button>
        )}
      </div>
    </Sheet>
  );
}

/** On a card whose project tracks time: start or stop its timer, and the time spent on it so far. */
export function CardTimer({ task }: { task: Task }) {
  const project = useProject(task.project_id);
  const running = useRunningEntry();
  const entries = useTimeEntries();
  const lookup = useTimeLookup();
  const mine = running && running.time_task_id && lookup.tasks.get(running.time_task_id)?.task_id === task.id ? running : null;
  const now = useNow(!!mine);
  if (!project || !tracksTime(project) || !entries || !lookup.loaded) return null;

  const linked = new Set([...lookup.tasks.values()].filter((t) => t.task_id === task.id).map((t) => t.id));
  const total = entries.filter((e) => e.time_task_id && linked.has(e.time_task_id)).reduce((sum, e) => sum + entrySeconds(e, now), 0);

  return (
    <div className="flex items-center gap-3">
      {mine ? (
        <button type="button" className="btn-primary min-h-10 px-4 text-sm" onClick={() => void stopTimer(mine.id)}>
          Stop <span className="font-mono tabular-nums">{formatClock(entrySeconds(mine, now))}</span>
        </button>
      ) : (
        <button type="button" className="btn-outline min-h-10 px-4 text-sm" onClick={() => void startCardTimer(task)}>
          <ClockIcon width={18} height={18} /> Track time
        </button>
      )}
      {total > 0 && <span className="text-sm font-semibold text-fg-2">{formatHours(total)} tracked</span>}
    </div>
  );
}
