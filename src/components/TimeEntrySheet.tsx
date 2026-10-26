import { useState } from 'react';
import { addEntry, deleteEntry, ensureTimeTag, ensureTimeTask, stopTimer, updateEntry } from '../db/time';
import type { TimeEntry } from '../db/types';
import { addDays, dayKey, todayKey } from '../lib/dates';
import { entrySeconds, formatHours, nameKey } from '../lib/time';
import { Sheet } from './Sheet';
import { useTimeLookup, type TimeLookup } from './useTimeLookup';

const pad = (n: number) => String(n).padStart(2, '0');
const timeInput = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
/** Local date and HH:MM inputs as an ISO instant. */
const fromInputs = (date: string, time: string) => new Date(`${date}T${time}`).toISOString();

/**
 * Edit a time entry, or add a finished one when `entry` is missing. The task is
 * typed: a new name becomes a new task in the chosen project.
 */
export function TimeEntrySheet(props: {
  entry?: TimeEntry;
  /** Project for a new entry. */
  projectId?: string | null;
  onClose: () => void;
}) {
  const lookup = useTimeLookup();
  // The form starts from the entry's task name, so wait for the names to load.
  return lookup.loaded ? <EntryForm {...props} lookup={lookup} /> : null;
}

function EntryForm({
  entry,
  projectId,
  onClose,
  lookup,
}: {
  entry?: TimeEntry;
  projectId?: string | null;
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
  const [project, setProject] = useState<string>(entry?.project_id ?? projectId ?? '');
  const [taskName, setTaskName] = useState((entry?.time_task_id && lookup.tasks.get(entry.time_task_id)?.name) || '');
  const [description, setDescription] = useState(entry?.description ?? '');
  const [date, setDate] = useState(initial.date);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [tagIds, setTagIds] = useState<string[]>(entry?.tag_ids ?? []);
  const [newTag, setNewTag] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const running = !!entry && !entry.ended_at;
  const options = lookup.timeProjects.filter((p) => p.id !== entry?.project_id);
  const current = entry?.project_id ? lookup.projects.get(entry.project_id) : undefined;
  const suggestions = lookup.tasksOf(project || null);
  const tags = [...lookup.tags.values()].filter((t) => !t.archived_at || tagIds.includes(t.id));

  // An end time earlier than the start means the entry ran past midnight.
  const startIso = fromInputs(date, startTime);
  const endIso = endTime ? fromInputs(endTime < startTime ? addDays(date, 1) : date, endTime) : null;

  async function save() {
    setError(null);
    try {
      const name = taskName.trim();
      const projectIdOrNull = project || null;
      const task = name
        ? (lookup.tasksOf(projectIdOrNull).find((t) => nameKey(t.name) === nameKey(name)) ?? (await ensureTimeTask(projectIdOrNull, name)))
        : null;
      const fields = {
        project_id: projectIdOrNull,
        time_task_id: task?.id ?? null,
        description: description.trim() || null,
        tag_ids: tagIds,
      };
      if (!entry) {
        if (!endIso) throw new Error('Add an end time.');
        await addEntry({ ...fields, started_at: startIso, ended_at: endIso });
      } else {
        const changes: Partial<TimeEntry> = { ...fields };
        const timesChanged = date !== initial.date || startTime !== initial.startTime || endTime !== initial.endTime;
        if (timesChanged) {
          changes.started_at = startIso;
          if (!running) {
            if (!endIso) throw new Error('Add an end time.');
            changes.ended_at = endIso;
          }
        }
        await updateEntry(entry.id, changes);
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function addTag() {
    const name = newTag.trim();
    if (!name) return;
    const tag = await ensureTimeTag(name);
    setTagIds((ids) => (ids.includes(tag.id) ? ids : [...ids, tag.id]));
    setNewTag('');
  }

  const preview = endIso ? entrySeconds({ started_at: startIso, ended_at: endIso }) : null;

  return (
    <Sheet
      title={entry ? (running ? 'Running timer' : 'Time entry') : 'Add time'}
      onClose={onClose}
      side="center"
      footer={
        <div className="flex w-full items-center gap-2 pb-2">
          {entry && !confirmDelete && (
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
            <button className="btn-outline" onClick={() => void stopTimer(entry.id).then(onClose)}>Stop</button>
          )}
          <button className="btn-primary" onClick={() => void save()}>Save</button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <div>
          <label className="field-label" htmlFor="time-project">Project</label>
          <select id="time-project" className="input" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">No project</option>
            {current && <option value={current.id}>{lookup.projectLabel(current.id)}</option>}
            {options.map((p) => (
              <option key={p.id} value={p.id}>{lookup.projectLabel(p.id)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="time-task">Task</label>
          <input
            id="time-task"
            className="input"
            list="time-task-names"
            placeholder="Optional, e.g. Laps or Balatro"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
          <datalist id="time-task-names">
            {suggestions.map((t) => (
              <option key={t.id} value={t.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="field-label" htmlFor="time-desc">Description</label>
          <input id="time-desc" className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="field-label" htmlFor="time-date">Date</label>
            <input id="time-date" type="date" className="input" value={date} max={todayKey()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="time-start">Start</label>
            <input id="time-start" type="time" className="input" value={startTime} onChange={(e) => e.target.value && setStartTime(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="time-end">End</label>
            {running ? (
              <p className="flex min-h-12 items-center text-base font-semibold text-accent">Running</p>
            ) : (
              <input id="time-end" type="time" className="input" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            )}
          </div>
        </div>
        {preview !== null && <p className="-mt-2 text-sm text-fg-2">{formatHours(preview)}{endTime < startTime ? ', ending the next day' : ''}</p>}
        <div>
          <span className="field-label">Tags</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const on = tagIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  className={`min-h-10 rounded-sm border-2 px-3 text-sm font-semibold ${on ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
                  onClick={() => setTagIds((ids) => (on ? ids.filter((id) => id !== t.id) : [...ids, t.id]))}
                >
                  {t.name}
                </button>
              );
            })}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void addTag();
            }}
          >
            <input className="input" placeholder="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
            <button className="btn-outline shrink-0" disabled={!newTag.trim()}>Add</button>
          </form>
        </div>
        {error && <p className="text-base font-semibold text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
