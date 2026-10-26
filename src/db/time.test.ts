import { beforeEach, describe, expect, it } from 'vitest';
import { db, clearLocalData } from './db';
import { setCurrentUser } from './mutate';
import type { Task } from './types';
import { addEntry, continueEntry, deleteEntry, startCardTimer, ensureTimeTag, ensureTimeTask, runningEntries, startTimer, stopTimer, updateEntry } from './time';

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
});

const outboxKeys = async () => (await db.outbox.toArray()).filter((o) => o.table === 'time_entries').map((o) => o.key);

describe('time entries', () => {
  it('runs one timer at a time: starting one stops the running one', async () => {
    const first = await startTimer({ project_id: 'p1' });
    expect(await runningEntries()).toHaveLength(1);
    const second = await startTimer({ project_id: 'p2', description: '  focus  ' });
    const running = await runningEntries();
    expect(running.map((e) => e.id)).toEqual([second.id]);
    expect(running[0].description).toBe('focus');
    expect((await db.time_entries.get(first.id))!.ended_at).toBe(second.started_at);
    expect(await outboxKeys()).toEqual(expect.arrayContaining([first.id, second.id]));
  });

  it('continues an entry as a new running timer', async () => {
    const e = await addEntry({ started_at: '2026-10-22T10:00:00.000Z', ended_at: '2026-10-22T11:00:00.000Z', project_id: 'p1', time_task_id: 't1', tag_ids: ['g'], description: 'laps' });
    const next = await continueEntry(e);
    expect(next).toMatchObject({ project_id: 'p1', time_task_id: 't1', tag_ids: ['g'], description: 'laps', ended_at: null });
    expect(next.id).not.toBe(e.id);
  });

  it('stops a timer', async () => {
    const e = await startTimer();
    await stopTimer(e.id);
    expect(await runningEntries()).toHaveLength(0);
    expect((await db.time_entries.get(e.id))!.ended_at).not.toBeNull();
  });

  it('adds and edits finished entries, refusing ones that end before they start', async () => {
    const e = await addEntry({ started_at: '2026-10-22T10:00:00.000Z', ended_at: '2026-10-22T11:00:00.000Z', tag_ids: ['t'] });
    expect(e).toMatchObject({ project_id: null, tag_ids: ['t'], fields: {}, source: null });
    await expect(addEntry({ started_at: '2026-10-22T10:00:00.000Z', ended_at: '2026-10-22T09:00:00.000Z' })).rejects.toThrow();
    await expect(updateEntry(e.id, { ended_at: '2026-10-22T09:00:00.000Z' })).rejects.toThrow();
    await updateEntry(e.id, { project_id: 'p1' });
    expect((await db.time_entries.get(e.id))!.project_id).toBe('p1');
    await deleteEntry(e.id);
    expect((await db.time_entries.get(e.id))!.deleted_at).not.toBeNull();
  });
});

describe('time tasks and tags', () => {
  it("reuses a project's task or tag with the same name", async () => {
    const t = await ensureTimeTask('p1', 'Silksong');
    expect((await ensureTimeTask('p1', '  silksong ')).id).toBe(t.id);
    expect((await ensureTimeTask('p2', 'Silksong')).id).not.toBe(t.id);
    const tag = await ensureTimeTag('PS5');
    expect((await ensureTimeTag('ps5')).id).toBe(tag.id);
    expect(await db.time_tasks.count()).toBe(2);
  });
});

describe('card timers', () => {
  it('tracks a card through one time task linked to it', async () => {
    const card = { id: 'c1', project_id: 'p1', title: ' Board script ' } as Task;
    const first = await startCardTimer(card);
    const second = await startCardTimer(card);
    expect(first.time_task_id).toBe(second.time_task_id);
    expect(await db.time_tasks.get(first.time_task_id!)).toMatchObject({ project_id: 'p1', name: 'Board script', task_id: 'c1' });
    expect(second.project_id).toBe('p1');
  });
});
