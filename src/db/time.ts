import { db } from './db';
import { newRow, now, patch, put, writeTx } from './mutate';
import type { Task, TimeEntry, TimeTag, TimeTask } from './types';
import { nameKey } from '../lib/time';

// Time tracking writes. Only one timer runs at a time: starting one stops the
// running one, as in Clockify.

const alive = <T extends { deleted_at: string | null }>(r: T) => !r.deleted_at;

export interface EntryInput {
  project_id?: string | null;
  time_task_id?: string | null;
  tag_ids?: string[];
  description?: string | null;
  fields?: Record<string, string>;
}

export async function runningEntries(): Promise<TimeEntry[]> {
  return (await db.time_entries.toArray()).filter((e) => alive(e) && !e.ended_at);
}

function entry(input: EntryInput, started_at: string, ended_at: string | null): TimeEntry {
  return {
    ...newRow(),
    started_at,
    ended_at,
    project_id: input.project_id ?? null,
    time_task_id: input.time_task_id ?? null,
    tag_ids: input.tag_ids ?? [],
    description: input.description?.trim() || null,
    fields: input.fields ?? {},
    source: null,
  };
}

/** Start a timer now, stopping any that is running. */
export async function startTimer(input: EntryInput = {}): Promise<TimeEntry> {
  const t = now();
  const running = await runningEntries();
  const started = entry(input, t, null);
  await writeTx(async () => {
    for (const r of running) {
      const stopped = { ...r, ended_at: t, updated_at: t };
      await db.time_entries.put(stopped);
      await db.outbox.add({ table: 'time_entries', key: r.id });
    }
    await db.time_entries.put(started);
    await db.outbox.add({ table: 'time_entries', key: started.id });
  });
  return started;
}

export async function stopTimer(id: string): Promise<void> {
  const e = await db.time_entries.get(id);
  if (!e || e.ended_at) return;
  // A clock that moved backwards must not give a negative entry.
  const t = now();
  await patch('time_entries', id, { ended_at: t < e.started_at ? e.started_at : t });
}

/** Add a finished entry (manual "Add time"). */
export async function addEntry(input: EntryInput & { started_at: string; ended_at: string }): Promise<TimeEntry> {
  if (input.ended_at < input.started_at) throw new Error('An entry must end after it starts.');
  const e = entry(input, input.started_at, input.ended_at);
  await put('time_entries', e);
  return e;
}

export async function updateEntry(id: string, changes: Partial<TimeEntry>): Promise<void> {
  const e = await db.time_entries.get(id);
  if (!e) return;
  const next = { ...e, ...changes };
  if (next.ended_at && next.ended_at < next.started_at) throw new Error('An entry must end after it starts.');
  await patch('time_entries', id, changes);
}

/** Start a new timer on the same project, task, tags and description as `e`. */
export const continueEntry = (e: TimeEntry) =>
  startTimer({ project_id: e.project_id, time_task_id: e.time_task_id, tag_ids: e.tag_ids, description: e.description, fields: e.fields });

export const deleteEntry = (id: string) => patch('time_entries', id, { deleted_at: now() });
export const restoreEntry = (id: string) => patch('time_entries', id, { deleted_at: null });

/** The project's time task with this name, created if it doesn't exist yet. */
export async function ensureTimeTask(projectId: string | null, name: string): Promise<TimeTask> {
  const key = nameKey(name);
  const existing = (await db.time_tasks.toArray()).find(
    (t) => alive(t) && t.project_id === projectId && nameKey(t.name) === key,
  );
  if (existing) return existing;
  const task: TimeTask = { ...newRow(), project_id: projectId, name: name.trim(), task_id: null, archived_at: null };
  await put('time_tasks', task);
  return task;
}

/** The tag with this name, created if it doesn't exist yet. */
export async function ensureTimeTag(name: string): Promise<TimeTag> {
  const key = nameKey(name);
  const existing = (await db.time_tags.toArray()).find((t) => alive(t) && nameKey(t.name) === key);
  if (existing) return existing;
  const tag: TimeTag = { ...newRow(), name: name.trim(), archived_at: null };
  await put('time_tags', tag);
  return tag;
}

/** The time task linked to a card, created (named after the card) if it doesn't exist yet. */
export async function ensureCardTimeTask(card: Task): Promise<TimeTask> {
  const existing = (await db.time_tasks.where('project_id').equals(card.project_id).toArray()).find(
    (t) => alive(t) && t.task_id === card.id,
  );
  if (existing) return existing;
  const task: TimeTask = { ...newRow(), project_id: card.project_id, name: card.title.trim(), task_id: card.id, archived_at: null };
  await put('time_tasks', task);
  return task;
}

/** Start a timer on a card's project, against the card. */
export async function startCardTimer(card: Task): Promise<TimeEntry> {
  const task = await ensureCardTimeTask(card);
  return startTimer({ project_id: card.project_id, time_task_id: task.id });
}
