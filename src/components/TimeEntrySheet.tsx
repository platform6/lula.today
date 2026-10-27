import { useState, type ReactNode } from 'react';
import { useTimeFields } from '../db/hooks';
import { addEntry, deleteEntry, ensureTimeTag, ensureTimeTask, updateEntry } from '../db/time';
import type { TimeEntry } from '../db/types';
import { addDays, dayKey, todayKey } from '../lib/dates';
import { entrySeconds, formatDuration, nameKey, parseDuration, timesProblem } from '../lib/time';
import { BackIcon, CheckIcon, ChevronRightIcon, PlusIcon, SearchIcon } from './icons';
import { Sheet } from './Sheet';
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

export function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line rounded-md border border-line bg-surface-2">{children}</div>;
}

function Row({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-1 focus-within:bg-surface">
      <label className="shrink-0 text-base" htmlFor={htmlFor}>{label}</label>
      <div className="flex min-w-0 flex-1 justify-end">{children}</div>
    </div>
  );
}

export function PickRow({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-surface" onClick={onClick}>
      <span className="shrink-0 text-base">{label}</span>
      <span className="flex min-w-0 flex-1 justify-end text-base text-fg-2">{children}</span>
      <ChevronRightIcon className="shrink-0 text-fg-2" />
    </button>
  );
}

export function Dot({ color }: { color: string | null }) {
  return <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color ?? 'var(--line-strong)' }} />;
}

type Item = { id: string; label: string; color?: string | null; group?: string };

/**
 * A searchable list to pick from, as in Clockify: a "Without …" row, the items
 * (grouped when they have a group), and a row to create what was searched for.
 */
function Picker({
  search,
  none,
  items,
  isSelected,
  onPick,
  onCreate,
  children,
}: {
  search: string;
  none?: { label: string; selected: boolean; onPick: () => void };
  items: Item[];
  isSelected: (id: string) => boolean;
  onPick: (id: string) => void;
  onCreate?: (name: string) => void;
  /** Shown between the search and the list (e.g. tabs). */
  children?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const key = nameKey(query);
  const shown = key ? items.filter((i) => nameKey(`${i.group ?? ''} ${i.label}`).includes(key)) : items;
  const exact = items.some((i) => nameKey(i.label) === key);

  const groups: [string | undefined, Item[]][] = [];
  for (const item of shown) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.group) last[1].push(item);
    else groups.push([item.group, [item]]);
  }

  const row = 'flex min-h-14 w-full items-center gap-3 px-4 text-left text-base hover:bg-surface';
  const check = (on: boolean) => (on ? <CheckIcon className="shrink-0 text-accent" width={22} height={22} /> : null);

  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="relative block">
        <span className="sr-only">{search}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" />
        <input autoFocus className="input pl-10" placeholder={search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {children}
      {none && !key && (
        <button className={`${row} rounded-md border border-line bg-surface-2`} onClick={none.onPick}>
          <span className="flex-1">{none.label}</span>
          {check(none.selected)}
        </button>
      )}
      {onCreate && key && !exact && (
        <button className={`${row} rounded-md border border-line bg-surface-2 font-semibold`} onClick={() => onCreate(query.trim())}>
          <PlusIcon className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">Create “{query.trim()}”</span>
        </button>
      )}
      {groups.map(([group, list], i) => (
        <div key={`${group ?? ''}-${i}`}>
          {group && <h3 className="px-1 pb-1 text-sm font-semibold text-fg-2">{group}</h3>}
          <div className="divide-y divide-line rounded-md border border-line bg-surface-2">
            {list.map((item) => (
              <button key={item.id} className={row} onClick={() => onPick(item.id)}>
                {item.color !== undefined && <Dot color={item.color} />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {check(isSelected(item.id))}
              </button>
            ))}
          </div>
        </div>
      ))}
      {shown.length === 0 && !(onCreate && key) && <p className="px-1 text-base text-fg-2">Nothing matches.</p>}
    </div>
  );
}

export function ProjectPicker({ lookup, selected, onPick }: { lookup: TimeLookup; selected: string; onPick: (id: string) => void }) {
  const projects = [...lookup.timeProjects];
  // Keep an entry's project pickable even if it no longer tracks time.
  const current = selected ? lookup.projects.get(selected) : undefined;
  if (current && !projects.some((p) => p.id === current.id)) projects.unshift(current);

  const items: Item[] = projects.map((p) => {
    const realm = p.area_id ? lookup.areas.get(p.area_id)?.name : undefined;
    return {
      id: p.id,
      label: p.is_area_default ? (realm ?? p.name) : p.name,
      color: lookup.projectColor(p.id),
      group: realm ?? 'No realm',
    };
  });

  return (
    <Picker
      search="Search projects"
      none={{ label: 'Without project', selected: !selected, onPick: () => onPick('') }}
      items={items}
      isSelected={(id) => id === selected}
      onPick={onPick}
    >
      {lookup.timeProjects.length === 0 && (
        <p className="text-base text-fg-2">
          No project tracks time yet. Tick <b>Time tracking</b> in a realm’s or project’s options to pick it here.
        </p>
      )}
    </Picker>
  );
}

export function TaskPicker({
  lookup,
  projectId,
  selected,
  onPick,
}: {
  lookup: TimeLookup;
  projectId: string | null;
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  const tasks = lookup.tasksOf(projectId);
  const current = selected ? lookup.tasks.get(selected) : undefined;
  if (current && !tasks.some((t) => t.id === current.id)) tasks.unshift(current);

  return (
    <Picker
      search="Search"
      none={{ label: 'Without task', selected: !selected, onPick: () => onPick(null) }}
      items={tasks.map((t) => ({ id: t.id, label: t.name }))}
      isSelected={(id) => id === selected}
      onPick={onPick}
      onCreate={(name) => void ensureTimeTask(projectId, name).then((t) => onPick(t.id))}
    >
      <p className="text-sm text-fg-2">
        {projectId ? <>Tasks in {lookup.projectLabel(projectId)}</> : 'Tasks with no project. Pick a project first to see its tasks.'}
      </p>
    </Picker>
  );
}

export function TagPicker({ lookup, selected, onToggle }: { lookup: TimeLookup; selected: string[]; onToggle: (id: string) => void }) {
  const [archived, setArchived] = useState(false);
  const tags = [...lookup.tags.values()].filter((t) => !!t.archived_at === archived);
  const tab = (on: boolean) =>
    `min-h-11 flex-1 rounded-sm text-base font-semibold ${on ? 'bg-surface text-fg shadow' : 'text-fg-2'}`;

  return (
    <Picker
      search="Search"
      items={tags.map((t) => ({ id: t.id, label: t.name }))}
      isSelected={(id) => selected.includes(id)}
      onPick={onToggle}
      onCreate={
        archived
          ? undefined
          : (name) =>
              void ensureTimeTag(name).then((t) => {
                if (!selected.includes(t.id)) onToggle(t.id);
              })
      }
    >
      <div className="flex gap-1 rounded-md border border-line bg-surface-2 p-1" role="tablist" aria-label="Tags">
        <button role="tab" aria-selected={!archived} className={tab(!archived)} onClick={() => setArchived(false)}>Active</button>
        <button role="tab" aria-selected={archived} className={tab(archived)} onClick={() => setArchived(true)}>Archived</button>
      </div>
    </Picker>
  );
}
