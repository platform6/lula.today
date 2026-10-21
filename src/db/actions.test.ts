import { beforeEach, describe, expect, it } from 'vitest';
import { db, clearLocalData } from './db';
import { setCurrentUser } from './mutate';
import { onTaskCompleted } from '../lib/celebrate';
import {
  areaDeleteBlocker,
  completeProject,
  createArea,
  getAreaDefault,
  moveTaskToRealm,
  tagTask,
  addStep,
  updateStep,
  updateTask,
  reopenProject,
  updateArea,
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
  skipOccurrence,
  moveAreaTo,
} from './actions';
import { byPosition } from '../lib/position';
import { presetRule } from '../lib/recurrence';
import { dayKey } from '../lib/dates';

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

describe('areas and their built-in task lists', () => {
  it('creates a built-in list with columns when an area is created', async () => {
    const area = await createArea('Home', '#f00');
    const own = await getAreaDefault(area.id);
    expect(own).toBeTruthy();
    expect(own!.is_area_default).toBe(true);
    expect(own!.color).toBe('#f00');
    expect((await columnsOf(own!.id)).length).toBe(4);
  });

  it('derives the same ids on every device, so offline devices converge', async () => {
    const area = await createArea('Home');
    const first = (await getAreaDefault(area.id))!;
    const firstCols = (await columnsOf(first.id)).map((c) => c.id);

    // Simulate another device: same area row, no built-in list yet.
    await clearLocalData();
    setCurrentUser('user-1');
    await db.areas.put(area);
    await ensureDefaults();
    const second = (await getAreaDefault(area.id))!;
    expect(second.id).toBe(first.id);
    expect((await columnsOf(second.id)).map((c) => c.id)).toEqual(firstCols);
  });

  it('backfills built-in lists for areas that predate them, exactly once', async () => {
    const area = await createArea('Work');
    await db.projects.clear();
    await ensureDefaults();
    await ensureDefaults();
    const defaults = (await db.projects.toArray()).filter((p) => p.is_area_default && p.area_id === area.id);
    expect(defaults).toHaveLength(1);
  });

  it('renames the built-in list and recolors projects with the area', async () => {
    const area = await createArea('Home', '#111111');
    const project = await createProject({ name: 'Garage', area_id: area.id });
    expect(project.color).toBe('#111111');
    await updateArea(area.id, { name: 'House', color: '#222222' });
    expect((await getAreaDefault(area.id))!.name).toBe('House');
    expect((await db.projects.get(project.id))!.color).toBe('#222222');
    expect((await db.projects.get(project.id))!.name).toBe('Garage');
  });

  it('refuses to delete an area that still has projects or open tasks', async () => {
    const area = await createArea('Home');
    const project = await createProject({ name: 'Garage', area_id: area.id });
    expect(await areaDeleteBlocker(area.id)).toMatch(/project/);
    await completeProject(project.id, 'archive');
    const own = (await getAreaDefault(area.id))!;
    await createTask({ title: 'Call plumber', project_id: own.id });
    expect(await areaDeleteBlocker(area.id)).toMatch(/open task/);
  });
});

describe('title case on entry', () => {
  it('applies to new and edited task titles and steps', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const t = await createTask({ title: 'call the iPhone store about a refund', project_id: p.id });
    expect(t.title).toBe('Call the iPhone Store About a Refund');

    await updateTask(t.id, { title: 'renew passport' });
    expect((await db.tasks.get(t.id))!.title).toBe('Renew Passport');

    await addStep(t.id, 'find old passport');
    const step = (await db.steps.where('task_id').equals(t.id).first())!;
    expect(step.text).toBe('Find Old Passport');
    await updateStep(step.id, { text: 'take a photo' });
    expect((await db.steps.get(step.id))!.text).toBe('Take a Photo');
  });
});

describe('tagging from a task', () => {
  it('creates a new tag or reuses one with the same name', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const t = await createTask({ title: 'T', project_id: p.id });
    await tagTask(t.id, 'Errands', '#fff');
    await tagTask(t.id, '  errands ', '#000');
    const labels = (await db.labels.toArray()).filter((l) => !l.deleted_at);
    expect(labels).toHaveLength(1);
    expect(labels[0].color).toBe('#fff');
    const links = (await db.task_labels.where('task_id').equals(t.id).toArray()).filter((l) => !l.deleted_at);
    expect(links.map((l) => l.label_id)).toEqual([labels[0].id]);
  });
});

describe('sorting the Inbox', () => {
  it('dropping a task on a realm makes it a realm task', async () => {
    await ensureDefaults();
    const inbox = (await getInbox())!;
    const area = await createArea('Health');
    const t = await createTask({ title: 'Book dentist', project_id: inbox.id });
    await moveTaskToRealm(t.id, area.id);
    const moved = (await db.tasks.get(t.id))!;
    const own = (await getAreaDefault(area.id))!;
    expect(moved.project_id).toBe(own.id);
    expect((await columnsOf(own.id)).find((c) => c.id === moved.column_id)?.is_done).toBe(false);
  });
});

describe('completing a project', () => {
  it('moves open tasks to the area list and archives the project', async () => {
    const area = await createArea('Home');
    const project = await createProject({ name: 'Garage', area_id: area.id });
    const [, , , done] = await columnsOf(project.id);
    const open = await createTask({ title: 'Sweep', project_id: project.id });
    const finished = await createTask({ title: 'Sort boxes', project_id: project.id, column_id: done.id });

    await completeProject(project.id, 'move');

    const p = (await db.projects.get(project.id))!;
    expect(p.completed_at).toBeTruthy();
    expect(p.archived_at).toBeTruthy();
    expect((await db.tasks.get(open.id))!.project_id).toBe((await getAreaDefault(area.id))!.id);
    expect((await db.tasks.get(finished.id))!.project_id).toBe(project.id);

    await reopenProject(project.id);
    expect((await db.projects.get(project.id))!.archived_at).toBeNull();
  });

  it('can archive open tasks along with the project instead', async () => {
    const area = await createArea('Home');
    const project = await createProject({ name: 'Garage', area_id: area.id });
    const open = await createTask({ title: 'Sweep', project_id: project.id });
    await completeProject(project.id, 'archive');
    expect((await db.tasks.get(open.id))!.archived_at).toBeTruthy();
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

describe('reordering realms', () => {
  it('puts a dragged realm at the drop position', async () => {
    const a = await createArea('A');
    await createArea('B');
    const c = await createArea('C');
    const order = async () => (await db.areas.toArray()).sort(byPosition).map((r) => r.name);

    await moveAreaTo(c.id, 0);
    expect(await order()).toEqual(['C', 'A', 'B']);
    await moveAreaTo(c.id, 2);
    expect(await order()).toEqual(['A', 'B', 'C']);
    await moveAreaTo(a.id, 1);
    expect(await order()).toEqual(['B', 'A', 'C']);
  });
});

describe('recurring tasks', () => {
  it('come back open with the next due date instead of completing', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const [backlog, , , done] = await columnsOf(p.id);
    const today = new Date();
    const due = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const t = await createTask({ title: 'Water', project_id: p.id, due_at: due.toISOString() });
    await updateTask(t.id, { recurrence: presetRule('weekly', due) });
    const fired: string[] = [];
    const off = onTaskCompleted((id) => fired.push(id));

    await moveTask(t.id, done.id);
    off();
    const after = (await db.tasks.get(t.id))!;
    expect(after.completed_at).toBeNull();
    expect(after.column_id).toBe(backlog.id);
    expect(dayKey(new Date(after.due_at!))).toBe(dayKey(new Date(due.getFullYear(), due.getMonth(), due.getDate() + 7)));
    expect(after.recurrence!.done).toBe(1);
    expect(fired).toEqual([t.id]);
  });

  it('complete for good after the last occurrence, and can skip one', async () => {
    const p = await createProject({ name: 'P', area_id: null });
    const [, , , done] = await columnsOf(p.id);
    const due = new Date();
    const t = await createTask({ title: 'Twice', project_id: p.id, due_at: due.toISOString() });
    await updateTask(t.id, { recurrence: { ...presetRule('daily', due), count: 2 } });

    await skipOccurrence(t.id);
    const skipped = (await db.tasks.get(t.id))!;
    expect(skipped.completed_at).toBeNull();
    expect(skipped.recurrence!.done).toBe(1);

    await moveTask(t.id, done.id);
    const finished = (await db.tasks.get(t.id))!;
    expect(finished.completed_at).toBeTruthy();
    expect(finished.column_id).toBe(done.id);
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
