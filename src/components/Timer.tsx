import { useEffect, useMemo, useRef, useState } from 'react';
import { useProject, useRunningEntry, useTimeEntries, useTimeFields } from '../db/hooks';
import { deleteEntry, runningEntries, startCardTimer, startTimer, stopTimer, updateEntry } from '../db/time';
import type { Task, TimeEntry } from '../db/types';
import { tracksTime } from '../lib/paths';
import { dayKey, sinceLabel } from '../lib/dates';
import { entrySeconds, formatDuration, runningLong, timesProblem } from '../lib/time';
import { BackIcon, ClockIcon, PlayIcon } from './icons';
import { Sheet } from './Sheet';
import { TimeEntrySheet } from './TimeEntrySheet';
import { Dot, Group, InputRow, PickRow, ProjectPicker, SwitchRow, TagPicker, TaskPicker } from './TimePickers';
import { useTimeLookup, type TimeLookup } from './useTimeLookup';
import { TimeFieldRows, keptValues, shownFields } from './TimeFieldRows';

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

  // Only a running timer shows; the + button starts one.
  if (!running || !lookup.loaded) return null;

  // A running timer is the loudest thing on screen: tinted, with a big live clock.
  const long = runningLong(running, now);
  const tint = long ? 'border-warn bg-warn/15' : 'border-accent bg-accent/15';
  const runningShell =
    variant === 'dock'
      ? `fixed inset-x-0 bottom-[calc(4rem+var(--tab-safe))] z-20 flex h-[4.5rem] items-center gap-3 border-t-2 px-4 py-2 md:hidden ${tint}`
      : `${variant === 'inline' ? 'mx-4 mt-4 md:hidden' : 'mx-2'} flex flex-col gap-2 rounded-md border-2 p-2 ${tint}`;
  const clockSize = variant === 'dock' ? 'text-2xl' : variant === 'inline' ? 'text-4xl' : 'text-2xl';

  // Phones are short on room: no Switch button (+ starts a new timer, which switches)
  // and no "Tap to edit" hint under the title.
  const phone = variant !== 'side';
  const subtitle = long
    ? `Running since ${sinceLabel(running.started_at)}`
    : running.time_task_id
      ? lookup.projectLabel(running.project_id)
      : running.description || (phone ? '' : 'Tap to edit');
  const title = (
    <button className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left leading-snug" onClick={() => setEditing(true)}>
      <span className="w-full truncate text-base font-bold">{lookup.entryTitle(running)}</span>
      {subtitle && (
        <span className={`w-full truncate font-semibold ${variant === 'dock' ? 'text-sm' : 'text-xs'} ${long ? 'text-warn' : 'text-fg-2'}`}>
          {subtitle}
        </span>
      )}
    </button>
  );
  const clock = (
    <span className={`shrink-0 font-mono font-bold tabular-nums ${clockSize}`} role="timer">
      {formatDuration(entrySeconds(running, now))}
    </span>
  );
  // A timer left on offers Stop at… (when it really ended); otherwise, on wide screens, Switch to something else.
  const actions = (
    <>
      {long ? (
        <button className="btn-outline min-h-11 shrink-0 px-3" onClick={() => setStoppingAt(true)}>Stop at…</button>
      ) : (
        !phone && <button className="btn-outline min-h-11 shrink-0 px-3" onClick={() => setPicking(true)}>Switch</button>
      )}
      <button className="btn-primary min-h-11 shrink-0 px-3" onClick={() => void stopTimer(running.id)}>
        Stop
      </button>
    </>
  );

  return (
    <>
      {variant === 'dock' ? (
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
      )}
      {picking && <TimerPicker lookup={lookup} onClose={() => setPicking(false)} />}
      {editing && <TimeEntrySheet entry={running} onClose={() => setEditing(false)} />}
      {stoppingAt && <StopAtSheet entry={running} onClose={() => setStoppingAt(false)} />}
    </>
  );
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
        <p className="text-base text-fg-2">Started {sinceLabel(entry.started_at)}. When did you finish?</p>
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
    // The timer the sheet just started isn't a recent entry.
    if (!e.ended_at) continue;
    const key = `${e.project_id}|${e.time_task_id}|${e.description ?? ''}|${!!e.commute}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length === limit) break;
  }
  return out;
}

type StartView = 'form' | 'project' | 'task' | 'tags';

/** How long after the last change the sheet saves it to the running timer. */
const SAVE_DELAY = 400;

/**
 * Start a timer: it starts the moment the sheet opens (stopping any other), and
 * project, task, tags and the optional description are saved to it as they're
 * picked. Nothing is focused on open, so a phone's keyboard stays down until the
 * description is tapped. A recent entry fills it in one tap; Discard takes it back,
 * restarting the timer this one switched from.
 */
export function TimerPicker({ lookup, onClose, projectId }: { lookup: TimeLookup; onClose: () => void; projectId?: string }) {
  const entries = useTimeEntries();
  // Started once per sheet, on open; the ref outlives React's dev-mode double mount.
  const started = useRef<Promise<{ entry: TimeEntry; switchedFrom: TimeEntry[] }> | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  useEffect(() => {
    started.current ??= (async () => {
      const switchedFrom = await runningEntries();
      return { entry: await startTimer({ project_id: projectId ?? null }), switchedFrom };
    })();
    void started.current.then(({ entry }) => setStartedAt(entry.started_at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const now = useNow(true);
  const [view, setView] = useState<StartView>('form');
  const [description, setDescription] = useState('');
  const [project, setProject] = useState(projectId ?? '');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [commute, setCommute] = useState(false);
  const [extra, setExtra] = useState<Record<string, string>>({});
  const fields = shownFields(useTimeFields() ?? [], lookup.realmOf(project || null));

  const recent = useMemo(
    () => recentEntries((entries ?? []).filter((e) => !projectId || e.project_id === projectId), 6),
    [entries, projectId],
  );
  const task = taskId ? lookup.tasks.get(taskId) : undefined;
  const tagNames = tagIds.map((id) => lookup.tags.get(id)?.name).filter(Boolean).join(', ');

  // What the sheet shows, saved to the running timer a moment after each change and on close.
  const values = { project_id: project || null, time_task_id: taskId, tag_ids: tagIds, description: description.trim() || null, commute, fields: keptValues(extra, fields) };
  const latest = useRef(values);
  latest.current = values;
  const dirty = useRef(false);
  const save = async () => {
    if (!dirty.current) return;
    dirty.current = false;
    const { entry } = await started.current!;
    await updateEntry(entry.id, latest.current);
  };
  const changed = useRef(false);
  useEffect(() => {
    // The first render is what the timer started with; only later changes need saving.
    if (!changed.current) {
      changed.current = true;
      return;
    }
    dirty.current = true;
    const t = setTimeout(() => void save(), SAVE_DELAY);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, taskId, tagIds, description, commute, extra]);

  const done = async () => {
    await save();
    onClose();
  };
  /** Take the timer back: delete it, and restart the one it switched from. */
  const discard = async () => {
    dirty.current = false;
    const { entry, switchedFrom } = await started.current!;
    await deleteEntry(entry.id);
    for (const e of switchedFrom) await updateEntry(e.id, { ended_at: null });
    onClose();
  };
  /** A recent entry's project, task, tags and description, on the timer that's already running. */
  const fillFrom = async (e: TimeEntry) => {
    dirty.current = false;
    const { entry } = await started.current!;
    await updateEntry(entry.id, {
      project_id: e.project_id,
      time_task_id: e.time_task_id,
      tag_ids: e.tag_ids,
      description: e.description,
      fields: e.fields,
      commute: !!e.commute,
    });
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
        fill
        onClose={() => void done()}
        title={
          <span className="flex items-center gap-1">
            <button className="btn-ghost -ml-2 px-2" onClick={() => setView('form')} aria-label="Back to the timer">
              <BackIcon width={24} height={24} />
            </button>
            {view === 'project' ? 'Projects' : view === 'task' ? 'Activities' : 'Tags'}
          </span>
        }
      >
        {view === 'project' && <ProjectPicker lookup={lookup} entries={entries ?? []} selected={project} onPick={pickProject} />}
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
            realmId={lookup.realmOf(project || null)}
            entries={entries ?? []}
            selected={tagIds}
            onToggle={(id) => setTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
          />
        )}
      </Sheet>
    );
  }

  return (
    <Sheet
      title={
        <span className="flex items-baseline gap-3">
          Timer running
          <span className="font-mono tabular-nums text-accent">
            {startedAt ? formatDuration(Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000))) : formatDuration(0)}
          </span>
        </span>
      }
      onClose={() => void done()}
      side="center"
      footer={
        <div className="flex w-full justify-end gap-2 pb-2">
          <button className="btn-ghost" onClick={() => void discard()}>
            Discard
          </button>
          <button className="btn-primary" onClick={() => void done()}>
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
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
          <PickRow label="Activity" onClick={() => setView('task')}>
            {task ? <span className="truncate text-fg">{task.name}</span> : 'Select activity'}
          </PickRow>
          <TimeFieldRows fields={fields} values={extra} entries={entries ?? []} onChange={(id, v) => setExtra((x) => ({ ...x, [id]: v }))} />
          <PickRow label="Tags" onClick={() => setView('tags')}>
            {tagNames ? <span className="truncate text-fg">{tagNames}</span> : 'Select tags'}
          </PickRow>
          <SwitchRow label="Commute" checked={commute} onChange={setCommute} />
        </Group>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void done();
          }}
        >
          <Group>
            <InputRow label="Description" htmlFor="timer-desc">
              <input
                id="timer-desc"
                className="min-h-12 min-w-0 flex-1 bg-transparent text-right text-base outline-none placeholder:text-muted"
                placeholder="Optional"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                enterKeyHint="go"
              />
            </InputRow>
          </Group>
        </form>

        {recent.length > 0 && (
          <section>
            <h2 className="kicker mb-1">Start again</h2>
            <div className="divide-y divide-line rounded-md border border-line">
              {recent.map((e) => (
                <button
                  key={e.id}
                  className="flex min-h-14 w-full items-center gap-3 px-3 text-left hover:bg-surface-2"
                  onClick={() => void fillFrom(e)}
                >
                  <Dot color={lookup.projectColor(e.project_id)} />
                  <span className="min-w-0 flex-1">
                    {e.description && <span className="block truncate text-base font-semibold">{e.description}</span>}
                    {/* Without a description, the project and activity are the title. */}
                    <span className={`block truncate ${e.description ? 'text-sm text-fg-2' : 'text-base font-semibold'}`}>
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
