import { useState, type ReactNode } from 'react';
import { useTimeFields } from '../db/hooks';
import { addEntry, deleteEntry, updateEntry } from '../db/time';
import type { TimeEntry } from '../db/types';
import { addDays, dayKey, todayKey } from '../lib/dates';
import { entrySeconds, formatDuration, parseDuration, timesProblem } from '../lib/time';
import { BackIcon } from './icons';
import { Sheet } from './Sheet';
import { Dot, Group, PickRow, ProjectPicker, TagPicker, TaskPicker } from './TimePickers';
import { useTimeLookup, type TimeLookup } from './useTimeLookup';

const pad = (n: number) => String(n).padStart(2, '0');
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Local date and HH:MM inputs as an ISO instant. */
const fromInputs = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

/**
 * Edit a time entry, or add a finished one when `entry` is missing. Laid out as
 * in Clockify: times first, then description, and project, task and tags pickers.
 */
export function TimeEntrySheet(props: {
  entry?: TimeEntry;
  /** Project for a new entry. */
  projectId?: string | null;
  /** Delete with Undo instead of asking first. */
  onDelete?: (e: TimeEntry) => void;
  onClose: () => void;
}) {
  const lookup = useTimeLookup();
  // The form starts from the entry's task and tag names, so wait for them to load.
  return lookup.loaded ? <EntryForm {...props} lookup={lookup} /> : null;
}

type View = 'form' | 'project' | 'task' | 'tags';

const VIEW_TITLES: Record<Exclude<View, 'form'>, string> = { project: 'Projects', task: 'Tasks', tags: 'Tags' };

function EntryForm({
  entry,
  projectId,
  onDelete,
  onClose,
  lookup,
}: {
  entry?: TimeEntry;
  projectId?: string | null;
  onDelete?: (e: TimeEntry) => void;
  onClose: () => void;
  lookup: TimeLookup;
}) {
  const start = entry ? new Date(entry.started_at) : new Date(Date.now() - 3600_000);
  const end = entry ? (entry.ended_at ? new Date(entry.ended_at) : null) : new Date();
  const initial = {
    date: dayKey(start),
    startTime: timeInput(start),
    endTime: end ? timeInput(end) : '',
  };
  const [view, setView] = useState<View>('form');
  const [project, setProject] = useState<string>(entry?.project_id ?? projectId ?? '');
  const [taskId, setTaskId] = useState<string | null>(entry?.time_task_id ?? null);
  const [description, setDescription] = useState(entry?.description ?? '');
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [tagIds, setTagIds] = useState<string[]>(entry?.tag_ids ?? []);
  const [extra, setExtra] = useState<Record<string, string>>(entry?.fields ?? {});
  // What's typed in Duration, until it's left; otherwise it shows start to end.
  const [durationText, setDurationText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const extraFields = (useTimeFields() ?? []).filter((f) => !f.archived_at || extra[f.id]);

  const running = !!entry && !entry.ended_at;
  const task = taskId ? lookup.tasks.get(taskId) : undefined;
  const timesChanged = date !== initial.date || startTime !== initial.startTime || endTime !== initial.endTime;

  // An end time earlier than the start means the entry ran past midnight.
  const startIso = fromInputs(date, startTime);
  const endIso = endTime ? fromInputs(endTime < startTime ? addDays(date, 1) : date, endTime) : null;
  // Untouched times keep the entry's seconds; the inputs only hold minutes.
  const seconds = entry?.ended_at && !timesChanged ? entrySeconds(entry) : endIso ? entrySeconds({ started_at: startIso, ended_at: endIso }) : null;
  const cleanFields = () => Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
  const sameTags = [...tagIds].sort().join() === [...(entry?.tag_ids ?? [])].sort().join();
  const dirty =
    timesChanged ||
    !sameTags ||
    project !== (entry?.project_id ?? projectId ?? '') ||
    taskId !== (entry?.time_task_id ?? null) ||
    description.trim() !== (entry?.description ?? '') ||
    JSON.stringify(cleanFields()) !== JSON.stringify(entry?.fields ?? {});

  /** Close, asking first if there are changes that would be lost. */
  function requestClose() {
    if (!dirty) return onClose();
    setView('form');
    setConfirmDelete(false);
    setConfirmDiscard(true);
  }

  const badDuration = durationText !== null && durationText.trim() !== '' && (parseDuration(durationText) ?? 86_400) >= 86_400;

  /** Save the form; `stop` also stops a running timer now, keeping the edits. */
  async function save(stop = false) {
    setError(null);
    try {
      const values = {
        project_id: project || null,
        time_task_id: taskId,
        description: description.trim() || null,
        tag_ids: tagIds,
        fields: cleanFields(),
      };
      if (!entry) {
        if (!endIso) throw new Error('Add an end time.');
        const problem = timesProblem(startIso, endIso);
        if (problem) throw new Error(problem);
        await addEntry({ ...values, started_at: startIso, ended_at: endIso });
      } else {
        const changes: Partial<TimeEntry> = { ...values };
        if (timesChanged) {
          changes.started_at = startIso;
          if (!running) {
            if (!endIso) throw new Error('Add an end time.');
            changes.ended_at = endIso;
          }
        }
        if (running && stop) changes.ended_at = new Date().toISOString();
        if (timesChanged || stop) {
          const problem = timesProblem(changes.started_at ?? entry.started_at, changes.ended_at ?? (running ? null : entry.ended_at));
          if (problem) throw new Error(problem);
        }
        await updateEntry(entry.id, changes);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // A typed duration moves the end time; start and end stay the source of truth.
  function typeDuration(text: string) {
    setDurationText(text);
    const s = parseDuration(text);
    if (s === null || s >= 86_400) return;
    setEndTime(timeInput(new Date(Date.parse(startIso) + s * 1000)));
  }

  function pickProject(id: string) {
    setProject(id);
    // A task belongs to one project, so a new project drops it.
    if (task && task.project_id !== (id || null)) setTaskId(null);
    setView('form');
  }

  if (view !== 'form') {
    return (
      <Sheet
        side="center"
        onClose={requestClose}
        title={
          <span className="flex items-center gap-1">
            <button className="btn-ghost -ml-2 px-2" onClick={() => setView('form')} aria-label="Back to the entry">
              <BackIcon width={24} height={24} />
            </button>
            {VIEW_TITLES[view]}
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

  const tagNames = tagIds.map((id) => lookup.tags.get(id)?.name).filter(Boolean).join(', ');

  return (
    <Sheet
      title={entry ? (running ? 'Running timer' : 'Edit entry') : 'New time entry'}
      onClose={requestClose}
      side="center"
      footer={
        confirmDiscard ? (
          <div className="flex w-full flex-wrap items-center gap-2 pb-2" role="alert">
            <span className="flex-1 text-base font-semibold">Discard your changes?</span>
            <button className="btn-ghost" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
            <button className="btn-danger border-2 border-danger" onClick={onClose}>Discard</button>
          </div>
        ) : (
          <div className="flex w-full items-center gap-2 pb-2">
            {entry && onDelete && !running && (
              <button className="btn-danger" onClick={() => { onDelete(entry); onClose(); }}>Delete</button>
            )}
            {entry && (!onDelete || running) && !confirmDelete && (
              <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
            )}
            {entry && confirmDelete && (
              <>
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn-danger border-2 border-danger" onClick={() => void deleteEntry(entry.id).then(onClose)}>
                  Delete entry
                </button>
              </>
            )}
            <div className="flex-1" />
            {running && (
              <button className="btn-outline" onClick={() => void save(true)}>Stop</button>
            )}
            <button className="btn-primary" onClick={() => void save()}>{entry ? 'Save' : 'Add'}</button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <Group>
          <Row label="Date" htmlFor="time-date">
            <input id="time-date" type="date" className={fieldClass} value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </Row>
          <Row label="Start" htmlFor="time-start">
            <input
              id="time-start"
              type="time"
              className={fieldClass}
              value={startTime}
              onChange={(e) => {
                if (!e.target.value) return;
                setStartTime(e.target.value);
                setDurationText(null);
              }}
            />
          </Row>
          <Row label="End" htmlFor="time-end">
            {running ? (
              <span className="text-base font-semibold text-accent">Running</span>
            ) : (
              <input
                id="time-end"
                type="time"
                className={fieldClass}
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setDurationText(null);
                }}
              />
            )}
          </Row>
          {!running && (
            <Row label="Duration" htmlFor="time-duration">
              <input
                id="time-duration"
                className="input w-36 text-right tabular-nums"
                placeholder="00:00:00"
                value={durationText ?? (seconds === null ? '' : formatDuration(seconds))}
                onChange={(e) => typeDuration(e.target.value)}
                onBlur={() => setDurationText(null)}
              />
            </Row>
          )}
        </Group>
        {badDuration ? (
          <p className="-mt-2 text-sm text-warn">Type a duration under 24 hours, like 1:30, 1h 30m or 45m.</p>
        ) : (
          !running && endTime && endTime < startTime && <p className="-mt-2 text-sm text-fg-2">Ends the next day.</p>
        )}

        <Group>
          <Row label="Description" htmlFor="time-desc">
            <input
              id="time-desc"
              className="min-h-12 min-w-0 flex-1 bg-transparent text-right text-base outline-none placeholder:text-muted"
              placeholder="What have you worked on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Row>
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
          {extraFields.map((f) => (
            <Row key={f.id} label={f.name} htmlFor={`time-field-${f.id}`}>
              {f.kind === 'choice' ? (
                <select
                  id={`time-field-${f.id}`}
                  className={fieldClass}
                  value={extra[f.id] ?? ''}
                  onChange={(e) => setExtra((x) => ({ ...x, [f.id]: e.target.value }))}
                >
                  <option value="">None</option>
                  {[...new Set([...f.choices, ...(extra[f.id] ? [extra[f.id]] : [])])].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`time-field-${f.id}`}
                  className="min-h-12 min-w-0 flex-1 bg-transparent text-right text-base outline-none"
                  value={extra[f.id] ?? ''}
                  onChange={(e) => setExtra((x) => ({ ...x, [f.id]: e.target.value }))}
                />
              )}
            </Row>
          ))}
        </Group>
        {error && <p className="text-base font-semibold text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}

const fieldClass = 'input w-auto min-w-0 text-right';

function Row({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-1 focus-within:bg-surface">
      <label className="shrink-0 text-base" htmlFor={htmlFor}>{label}</label>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}
