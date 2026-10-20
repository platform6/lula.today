import { beforeEach, describe, expect, it } from 'vitest';
import { db, clearLocalData } from './db';
import { setCurrentUser } from './mutate';
import { onTaskCompleted } from '../lib/celebrate';
import {
  columnsOf,
  createProject,
  createTask,
  deleteColumn,
  deleteTask,
  ensureDefaults,
  getInbox,
  moveTask,
  setColumnDone,
  setTaskCompleted,
} from './actions';

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
});

describe('bootstrap', () => {
  it('creates settings and a single Inbox with default columns', async () => {
    await ensureDefaults();
    await ensureDefaults();
    const inboxes = (await db.projects.toArray()).filter((p) => p.is_inbox);
    expect(inboxes).toHaveLength(1);
    const cols = await columnsOf(inboxes[0].id);
    expect(cols.map((c) => c.name)).toEqual(['Backlog', 'To Do', 'Doing', 'Done']);
    expect(cols.map((c) => c.is_done)).toEqual([false, false, false, true]);
    expect(await db.settings.get('user-1')).toBeTruthy();
  });
});

describe('tasks and columns', () => {
  it('sets completed_at when moved into a done column and clears it when moved out', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const [backlog, , , done] = await columnsOf(p.id);
    const t = await createTask({ title: 'T', project_id: p.id });
    expect(t.column_id).toBe(backlog.id);

    await moveTask(t.id, done.id);
    expect((await db.tasks.get(t.id))!.completed_at).toBeTruthy();

    await setTaskCompleted((await db.tasks.get(t.id))!, false);
    const reopened = (await db.tasks.get(t.id))!;
    expect(reopened.completed_at).toBeNull();
    expect(reopened.column_id).toBe(backlog.id);
  });

  it('marks existing tasks complete when a column becomes a done column', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const [backlog] = await columnsOf(p.id);
    const t = await createTask({ title: 'T', project_id: p.id });
    await setColumnDone(backlog.id, true);
    expect((await db.tasks.get(t.id))!.completed_at).toBeTruthy();
  });

  it('moves tasks out of a deleted column, keeping their order', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const [backlog, todo] = await columnsOf(p.id);
    const a = await createTask({ title: 'A', project_id: p.id, column_id: backlog.id });
    const b = await createTask({ title: 'B', project_id: p.id, column_id: backlog.id });
    await deleteColumn(backlog.id, todo.id);

    expect((await db.board_columns.get(backlog.id))!.deleted_at).toBeTruthy();
    const moved = (await db.tasks.where('column_id').equals(todo.id).toArray()).sort((x, y) =>
      x.position < y.position ? -1 : 1,
    );
    expect(moved.map((t) => t.id)).toEqual([a.id, b.id]);
  });

  it('refuses to delete a non-empty column without a target', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const [backlog] = await columnsOf(p.id);
    await createTask({ title: 'A', project_id: p.id });
    await expect(deleteColumn(backlog.id, null)).rejects.toThrow();
  });

  it('reorders within a column by index', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const a = await createTask({ title: 'A', project_id: p.id });
    const b = await createTask({ title: 'B', project_id: p.id });
    const c = await createTask({ title: 'C', project_id: p.id });
    await moveTask(c.id, a.column_id, 0);
    const order = (await db.tasks.toArray()).sort((x, y) => (x.position < y.position ? -1 : 1)).map((t) => t.title);
    expect(order).toEqual(['C', 'A', 'B']);
    expect(b).toBeTruthy();
  });
});

describe('completion event', () => {
  it('fires once when a task first enters a done column, not on moves within or out of done', async () => {
    const fired: string[] = [];
    const off = onTaskCompleted((id) => fired.push(id));
    try {
      const p = await createProject({ name: 'P', area_id: null });
      const [backlog, todo, , done] = await columnsOf(p.id);
      const t = await createTask({ title: 'T', project_id: p.id });

      await moveTask(t.id, todo.id);
      expect(fired).toEqual([]);

      await moveTask(t.id, done.id);
      expect(fired).toEqual([t.id]);

      await moveTask(t.id, done.id, 0); // reorder inside done
      expect(fired).toEqual([t.id]);

      await moveTask(t.id, backlog.id);
      await setTaskCompleted((await db.tasks.get(t.id))!, true);
      expect(fired).toEqual([t.id, t.id]);
    } finally {
      off();
    }
  });
});

describe('outbox', () => {
  it('queues every write and soft-deletes task children', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const t = await createTask({ title: 'T', project_id: p.id });
    const before = await db.outbox.count();
    await deleteTask(t.id);
    expect(await db.outbox.count()).toBeGreaterThan(before);
    expect((await db.tasks.get(t.id))!.deleted_at).toBeTruthy();
    const keys = (await db.outbox.toArray()).map((e) => `${e.table}:${e.key}`);
    expect(keys).toContain(`projects:${p.id}`);
    expect(keys).toContain(`tasks:${t.id}`);
  });

  it('finds the Inbox only once created', async () => {
    expect(await getInbox()).toBeUndefined();
    await ensureDefaults();
    expect(await getInbox()).toBeTruthy();
  });
});
