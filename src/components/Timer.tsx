import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject, useRunningEntry, useTimeEntries } from '../db/hooks';
import { continueEntry, ensureTimeTask, startCardTimer, startTimer, stopTimer } from '../db/time';
import type { Task, TimeEntry } from '../db/types';
import { tracksTime } from '../lib/paths';
import { entrySeconds, formatClock, formatHours, nameKey } from '../lib/time';
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

/** One tap to start, see or stop the timer. Docked above the tabs on phones, in the sidebar on wide screens. */
export function TimerBar({ variant }: { variant: 'dock' | 'side' }) {
  const running = useRunningEntry();
  const lookup = useTimeLookup();
  const now = useNow(!!running);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);

  if (running === undefined || !lookup.loaded) return null;

  const shell =
    variant === 'dock'
      ? 'fixed inset-x-0 bottom-[calc(4rem+var(--tab-safe))] z-20 flex h-14 items-center gap-2 border-t border-line bg-surface px-3 md:hidden'
      : 'mx-2 flex min-h-14 items-center gap-2 rounded-md border border-line bg-surface-2 px-2';

  return (
    <>
      {running ? (
        <div className={shell}>
          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
          <button className="flex min-w-0 flex-1 flex-col items-start text-left leading-tight" onClick={() => setEditing(true)}>
            <span className="w-full truncate text-base font-bold">{lookup.entryTitle(running)}</span>
            <span className="w-full truncate text-xs font-semibold text-fg-2">
              {running.time_task_id ? lookup.projectLabel(running.project_id) : running.description || 'Tap to edit'}
            </span>
          </button>
          <span className="shrink-0 font-mono text-lg font-bold tabular-nums">{formatClock(entrySeconds(running, now))}</span>
          <button className="btn-primary min-h-10 shrink-0 px-3" onClick={() => void stopTimer(running.id)}>
            Stop
          </button>
        </div>
      ) : (
        <div className={shell}>
          <button className="btn-ghost min-h-10 flex-1 justify-start px-2 text-fg" onClick={() => setPicking(true)}>
            <ClockIcon /> Start timer
          </button>
          <Link to="/time" className="btn-ghost min-h-10 shrink-0 px-2 text-sm">
            Time
          </Link>
        </div>
      )}
      {picking && <TimerPicker lookup={lookup} onClose={() => setPicking(false)} />}
      {editing && running && <TimeEntrySheet entry={running} onClose={() => setEditing(false)} />}
    </>
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
