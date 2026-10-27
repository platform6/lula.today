import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProject, useRunningEntry, useTimeEntries } from '../db/hooks';
import { continueEntry, startCardTimer, startTimer, stopTimer, updateEntry } from '../db/time';
import type { Task, TimeEntry } from '../db/types';
import { tracksTime } from '../lib/paths';
import { dayKey } from '../lib/dates';
import { entrySeconds, formatDuration, runningLong, timesProblem } from '../lib/time';
import { BackIcon, ClockIcon, PlayIcon } from './icons';
import { Sheet } from './Sheet';
import { Dot, Group, PickRow, ProjectPicker, TagPicker, TaskPicker, TimeEntrySheet } from './TimeEntrySheet';
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
 * shown only while a timer runs; + starts one).
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
      {formatDuration(entrySeconds(running, now))}
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
          <button className="btn-ghost min-h-11 flex-1 justify-start px-2 text-fg" onClick={() => setPicking(true)}>
            <ClockIcon /> Start timer
          </button>
          <Link to="/" className="btn-ghost min-h-11 shrink-0 px-2 text-sm">
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

/** Recent things tracked, newest first: one per project, task and description. */
function recentEntries(entries: TimeEntry[], limit: number): TimeEntry[] {
  const seen = new Set<string>();
  const out: TimeEntry[] = [];
  for (const e of entries) {
    const key = `${e.project_id}|${e.time_task_id}|${e.description ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length === limit) break;
  }
  return out;
}

type StartView = 'form' | 'project' | 'task' | 'tags';

/**
 * Start a timer: what you're working on, then project, task and tags with the
 * same pickers as the entry form. Recent entries start again in one tap.
 */
export function TimerPicker({ lookup, onClose, projectId }: { lookup: TimeLookup; onClose: () => void; projectId?: string }) {
  const entries = useTimeEntries();
  const [view, setView] = useState<StartView>('form');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState(projectId ?? '');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);

  const recent = useMemo(
    () => recentEntries((entries ?? []).filter((e) => !projectId || e.project_id === projectId), 6),
    [entries, projectId],
  );
  const task = taskId ? lookup.tasks.get(taskId) : undefined;
  const tagNames = tagIds.map((id) => lookup.tags.get(id)?.name).filter(Boolean).join(', ');

  const start = async () => {
    await startTimer({ project_id: project || null, time_task_id: taskId, tag_ids: tagIds, description });
    onClose();
  };
  const pickProject = (id: string) => {
    setProject(id);
    // A task belongs to one project, so a new project drops it.
    if (task && task.project_id !== (id || null)) setTaskId(null);
    setView('form');
  };

  if (view !== 'form') {
    return (
      <Sheet
        side="center"
        onClose={onClose}
        title={
          <span className="flex items-center gap-1">
            <button className="btn-ghost -ml-2 px-2" onClick={() => setView('form')} aria-label="Back to the timer">
              <BackIcon width={24} height={24} />
            </button>
            {view === 'project' ? 'Projects' : view === 'task' ? 'Tasks' : 'Tags'}
          </span>
        }
      >
        {view === 'project' && <ProjectPicker lookup={lookup} selected={project} onPick={pickProject} />}
        {view === 'task' && (
          <TaskPicker
            lookup={lookup}
            projectId={project || null}
            selected={taskId}
            onPick={(id) => {
              setTaskId(id);
              setView('form');
            }}
          />
        )}
        {view === 'tags' && (
          <TagPicker
            lookup={lookup}
            selected={tagIds}
            onToggle={(id) => setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
          />
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Start timer"
      onClose={onClose}
      side="center"
      footer={
        <div className="flex w-full justify-end gap-2 pb-2">
          <button className="btn-primary" onClick={() => void start()}>
            <PlayIcon width={18} height={18} /> Start
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void start();
          }}
        >
          <label className="sr-only" htmlFor="timer-desc">What are you working on?</label>
          <input
            id="timer-desc"
            autoFocus
            className="input"
            placeholder="What are you working on?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            enterKeyHint="go"
          />
        </form>

        <Group>
          <PickRow label="Project" onClick={() => setView('project')}>
            {project ? (
              <span className="flex min-w-0 items-center gap-2">
                <Dot color={lookup.projectColor(project)} />
                <span className="truncate text-fg">{lookup.projectLabel(project)}</span>
              </span>
            ) : (
              'Select project'
            )}
          </PickRow>
          <PickRow label="Task" onClick={() => setView('task')}>
            {task ? <span className="truncate text-fg">{task.name}</span> : 'Select task'}
          </PickRow>
          <PickRow label="Tags" onClick={() => setView('tags')}>
            {tagNames ? <span className="truncate text-fg">{tagNames}</span> : 'Select tags'}
          </PickRow>
        </Group>

        {recent.length > 0 && (
          <section>
            <h2 className="kicker mb-1">Start again</h2>
            <div className="divide-y divide-line rounded-md border border-line">
              {recent.map((e) => (
                <button
                  key={e.id}
                  className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-surface-2"
                  onClick={() => void continueEntry(e).then(onClose)}
                >
                  <Dot color={lookup.projectColor(e.project_id)} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-base ${e.description ? 'font-semibold' : 'text-muted'}`}>
                      {e.description || 'No description'}
                    </span>
                    <span className="block truncate text-sm text-fg-2">
                      {lookup.projectLabel(e.project_id)}
                      {e.time_task_id ? `: ${lookup.tasks.get(e.time_task_id)?.name ?? ''}` : ''}
                    </span>
                  </span>
                  <PlayIcon width={18} height={18} className="shrink-0 text-fg-2" />
                </button>
              ))}
            </div>
          </section>
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
        <button type="button" className="btn-primary min-h-11 px-4 text-sm" onClick={() => void stopTimer(mine.id)}>
          Stop <span className="font-mono tabular-nums">{formatDuration(entrySeconds(mine, now))}</span>
        </button>
      ) : (
        <button type="button" className="btn-outline min-h-11 px-4 text-sm" onClick={() => void startCardTimer(task)}>
          <ClockIcon width={18} height={18} /> Track time
        </button>
      )}
      {total > 0 && <span className="text-sm font-semibold text-fg-2">{formatDuration(total)} tracked</span>}
    </div>
  );
}
