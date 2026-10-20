import { db } from './db';
import { currentUserId, newRow, now, patch, put, putMany, writeTx } from './mutate';
import type {
  Area,
  BoardColumn,
  ColumnTemplate,
  Label,
  Priority,
  Project,
  Settings,
  Step,
  Task,
} from './types';
import { byPosition, keyAtEnd, keyAtIndex, keyAtStart, keyBetween } from '../lib/position';
import { stableUuid } from '../lib/ids';
import { titleCase } from '../lib/titleCase';
import { emitTaskCompleted } from '../lib/celebrate';

export const DEFAULT_COLUMNS: ColumnTemplate[] = [
  { name: 'Backlog', is_done: false },
  { name: 'To Do', is_done: false },
  { name: 'Doing', is_done: false },
  { name: 'Done', is_done: true },
];

const alive = <T extends { deleted_at: string | null }>(r: T) => !r.deleted_at;

// ---------------------------------------------------------------------------
// Reads used by actions
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<Settings | undefined> {
  return db.settings.get(currentUserId());
}

export async function columnsOf(projectId: string): Promise<BoardColumn[]> {
  return (await db.board_columns.where('project_id').equals(projectId).toArray()).filter(alive).sort(byPosition);
}

async function tasksInColumn(columnId: string, exceptId?: string): Promise<Task[]> {
  return (await db.tasks.where('column_id').equals(columnId).toArray())
    .filter((t) => alive(t) && t.id !== exceptId)
    .sort(byPosition);
}

export async function getInbox(): Promise<Project | undefined> {
  return (await db.projects.toArray()).find((p) => p.is_inbox && alive(p));
}

// ---------------------------------------------------------------------------
// Bootstrap (runs after a successful sync, so an existing Inbox is pulled first)
// ---------------------------------------------------------------------------

export async function ensureDefaults(): Promise<void> {
  const userId = currentUserId();
  let settings = await db.settings.get(userId);
  if (!settings) {
    const t = now();
    settings = { user_id: userId, default_columns: DEFAULT_COLUMNS, theme: 'dark', created_at: t, updated_at: t };
    await put('settings', settings);
  }
  if (!(await getInbox())) {
    const projects = (await db.projects.toArray()).filter(alive).sort(byPosition);
    await createProject({ name: 'Inbox', area_id: null, is_inbox: true, position: keyAtStart(projects) });
  }
  // Areas created before built-in task lists existed (or pulled from another device).
  for (const area of (await db.areas.toArray()).filter(alive)) {
    if (!(await getAreaDefault(area.id))) await createAreaDefault(area);
  }
}

// ---------------------------------------------------------------------------
// Areas
// ---------------------------------------------------------------------------

export async function getAreaDefault(areaId: string): Promise<Project | undefined> {
  return (await db.projects.where('area_id').equals(areaId).toArray()).find((p) => p.is_area_default && alive(p));
}

/** The area's built-in task list, with ids derived from the area so devices agree. */
async function createAreaDefault(area: Area): Promise<Project> {
  const id = await stableUuid(`area-default:${area.id}`);
  const existing = await db.projects.get(id);
  if (existing && alive(existing)) return existing;
  return createProject({
    id,
    name: area.name,
    area_id: area.id,
    color: area.color,
    is_area_default: true,
    position: keyBetween(null, null),
    stableColumnIds: true,
  });
}

export async function createArea(name: string, color: string | null = null): Promise<Area> {
  const areas = (await db.areas.toArray()).filter(alive).sort(byPosition);
  const area: Area = { ...newRow(), name, color, icon: null, position: keyAtEnd(areas), archived_at: null };
  await put('areas', area);
  await createAreaDefault(area);
  return area;
}

/** Name and color changes flow to the area's projects so the family reads together. */
export async function updateArea(id: string, changes: Partial<Area>): Promise<void> {
  await writeTx(async () => {
    await patch('areas', id, changes);
    const projects = (await db.projects.where('area_id').equals(id).toArray()).filter(alive);
    const updated = projects.flatMap((p) => {
      const next: Partial<Project> = {};
      if (changes.color !== undefined) next.color = changes.color;
      if (changes.name && p.is_area_default) next.name = changes.name; // built-in list mirrors the area
      return Object.keys(next).length ? [{ ...p, ...next }] : [];
    });
    await putMany('projects', updated);
  });
}

/** Why an area can't be deleted yet, or null if it can. */
export async function areaDeleteBlocker(id: string): Promise<string | null> {
  const projects = (await db.projects.where('area_id').equals(id).toArray()).filter(alive);
  const real = projects.filter((p) => !p.is_area_default && !p.archived_at);
  if (real.length) return `Move or complete its ${real.length} project${real.length === 1 ? '' : 's'} first.`;
  const def = projects.find((p) => p.is_area_default);
  if (def) {
    const open = (await db.tasks.where('project_id').equals(def.id).toArray()).filter(
      (t) => alive(t) && !t.completed_at && !t.archived_at,
    );
    if (open.length) return `Move or finish its ${open.length} open task${open.length === 1 ? '' : 's'} first.`;
  }
  return null;
}

/** Soft-delete an empty area along with its built-in task list and archived projects. */
export async function deleteArea(id: string): Promise<void> {
  const blocker = await areaDeleteBlocker(id);
  if (blocker) throw new Error(blocker);
  const projects = (await db.projects.where('area_id').equals(id).toArray()).filter(alive);
  for (const p of projects) await deleteProject(p.id);
  await patch('areas', id, { deleted_at: now() });
}

export async function moveArea(id: string, dir: -1 | 1): Promise<void> {
  const areas = (await db.areas.toArray()).filter(alive).sort(byPosition);
  await moveInList('areas', areas, id, dir);
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function createProject(input: {
  name: string;
  area_id: string | null;
  color?: string | null;
  is_inbox?: boolean;
  is_area_default?: boolean;
  position?: string;
  id?: string;
  /** Derive column ids from the project id (for rows every device may create). */
  stableColumnIds?: boolean;
}): Promise<Project> {
  const settings = await getSettings();
  const templates = settings?.default_columns?.length ? settings.default_columns : DEFAULT_COLUMNS;
  const siblings = (await db.projects.toArray())
    .filter((p) => alive(p) && p.area_id === input.area_id && !p.is_area_default)
    .sort(byPosition);
  const color =
    input.color !== undefined ? input.color : input.area_id ? ((await db.areas.get(input.area_id))?.color ?? null) : null;
  const project: Project = {
    ...newRow(),
    ...(input.id ? { id: input.id } : {}),
    area_id: input.area_id,
    name: input.name,
    color,
    description: null,
    due_date: null,
    is_inbox: input.is_inbox ?? false,
    is_area_default: input.is_area_default ?? false,
    position: input.position ?? keyAtEnd(siblings),
    completed_at: null,
    archived_at: null,
  };
  const columnIds = input.stableColumnIds
    ? await Promise.all(templates.map((_, i) => stableUuid(`${project.id}:column:${i}`)))
    : null;
  let prev: string | null = null;
  const columns: BoardColumn[] = templates.map((tpl, i) => {
    const position = keyBetween(prev, null);
    prev = position;
    const row = { ...newRow(), project_id: project.id, name: tpl.name, is_done: tpl.is_done, position };
    return columnIds ? { ...row, id: columnIds[i] } : row;
  });
  await writeTx(async () => {
    await put('projects', project);
    await putMany('board_columns', columns);
  });
  return project;
}

export const updateProject = (id: string, changes: Partial<Project>) => patch('projects', id, changes);

export async function archiveProject(id: string, archived: boolean): Promise<void> {
  await patch('projects', id, { archived_at: archived ? now() : null });
}

/** Open (live, not completed) tasks in a project. */
export async function openTasksOf(projectId: string): Promise<Task[]> {
  return (await db.tasks.where('project_id').equals(projectId).toArray()).filter(
    (t) => alive(t) && !t.completed_at && !t.archived_at,
  );
}

/**
 * Mark a project finished and archive it. Open tasks either move to the area's
 * own task list (they still need doing) or are archived with the project.
 */
export async function completeProject(id: string, openTasks: 'move' | 'archive'): Promise<void> {
  const project = await db.projects.get(id);
  if (!project || project.is_inbox || project.is_area_default) return;
  const open = await openTasksOf(id);
  if (open.length) {
    const target = openTasks === 'move' && project.area_id ? await getAreaDefault(project.area_id) : undefined;
    for (const task of open) {
      if (target) await moveTaskToProject(task.id, target.id);
      else await archiveTask(task.id);
    }
  }
  const t = now();
  await patch('projects', id, { completed_at: t, archived_at: t });
}

export async function reopenProject(id: string): Promise<void> {
  await patch('projects', id, { completed_at: null, archived_at: null });
}

/** Move a project to another area; it takes on the new area's color. */
export async function setProjectArea(id: string, areaId: string): Promise<void> {
  const area = await db.areas.get(areaId);
  await patch('projects', id, { area_id: areaId, color: area?.color ?? null });
}

/** Soft-delete a project and everything in it. */
export async function deleteProject(id: string): Promise<void> {
  const t = now();
  await writeTx(async () => {
    const tasks = await db.tasks.where('project_id').equals(id).toArray();
    for (const task of tasks) await deleteTaskTree(task, t);
    const columns = await db.board_columns.where('project_id').equals(id).toArray();
    await putMany('board_columns', columns.map((c) => ({ ...c, deleted_at: t })));
    await patch('projects', id, { deleted_at: t });
  });
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

export async function addColumn(projectId: string, name: string, isDone = false): Promise<void> {
  const columns = await columnsOf(projectId);
  // New non-done columns go before the first done column so "Done" stays last.
  const firstDone = columns.findIndex((c) => c.is_done);
  const index = isDone || firstDone === -1 ? columns.length : firstDone;
  await put('board_columns', {
    ...newRow(),
    project_id: projectId,
    name,
    is_done: isDone,
    position: keyAtIndex(columns, index),
  });
}

export const renameColumn = (id: string, name: string) => patch('board_columns', id, { name });

export async function setColumnDone(id: string, isDone: boolean): Promise<void> {
  const t = now();
  await writeTx(async () => {
    await patch('board_columns', id, { is_done: isDone });
    const tasks = await tasksInColumn(id);
    await putMany(
      'tasks',
      tasks.map((task) => ({ ...task, completed_at: isDone ? (task.completed_at ?? t) : null })),
    );
  });
}

export async function moveColumn(projectId: string, id: string, dir: -1 | 1): Promise<void> {
  await moveInList('board_columns', await columnsOf(projectId), id, dir);
}

/** Delete a column, moving its tasks to the end of `moveTo`. */
export async function deleteColumn(id: string, moveTo: string | null): Promise<void> {
  await writeTx(async () => {
    const tasks = await tasksInColumn(id);
    if (tasks.length > 0) {
      if (!moveTo) throw new Error('Choose a column for the remaining tasks');
      const target = await db.board_columns.get(moveTo);
      if (!target) throw new Error('Target column not found');
      const existing = await tasksInColumn(moveTo);
      const t = now();
      let tail: { position: string }[] = existing;
      const moved = tasks.map((task) => {
        const position = keyAtEnd(tail);
        tail = [{ position }];
        return { ...task, column_id: moveTo, position, completed_at: completedFor(task, target, t) };
      });
      await putMany('tasks', moved);
    }
    await patch('board_columns', id, { deleted_at: now() });
  });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

function completedFor(task: Task, column: BoardColumn, t: string): string | null {
  if (!column.is_done) return null;
  return task.completed_at ?? t;
}

export async function createTask(input: {
  title: string;
  project_id: string;
  column_id?: string;
  priority?: Priority;
  due_at?: string | null;
  due_has_time?: boolean;
  atTop?: boolean;
}): Promise<Task> {
  const columns = await columnsOf(input.project_id);
  const column =
    columns.find((c) => c.id === input.column_id) ?? columns.find((c) => !c.is_done) ?? columns[0];
  if (!column) throw new Error('Project has no columns');
  const siblings = await tasksInColumn(column.id);
  const t = now();
  const task: Task = {
    ...newRow(),
    project_id: input.project_id,
    column_id: column.id,
    title: titleCase(input.title),
    notes: null,
    url: null,
    priority: input.priority ?? 0,
    due_at: input.due_at ?? null,
    due_has_time: input.due_has_time ?? false,
    completed_at: column.is_done ? t : null,
    archived_at: null,
    position: input.atTop ? keyAtStart(siblings) : keyAtEnd(siblings),
  };
  await put('tasks', task);
  return task;
}

export const updateTask = (id: string, changes: Partial<Task>) =>
  patch('tasks', id, changes.title === undefined ? changes : { ...changes, title: titleCase(changes.title) });

/** Move a task to `index` within a column (index counts tasks excluding the moving one). */
export async function moveTask(taskId: string, columnId: string, index?: number): Promise<void> {
  let justCompleted = null as string | null; // set inside the transaction callback
  await writeTx(async () => {
    const task = await db.tasks.get(taskId);
    const column = await db.board_columns.get(columnId);
    if (!task || !column) return;
    const siblings = await tasksInColumn(columnId, taskId);
    const position = keyAtIndex(siblings, index ?? siblings.length);
    const completed_at = completedFor(task, column, now());
    await patch('tasks', taskId, {
      column_id: columnId,
      project_id: column.project_id,
      position,
      completed_at,
    });
    if (!task.completed_at && completed_at) justCompleted = taskId;
  });
  if (justCompleted) emitTaskCompleted(justCompleted);
}

/** Move a task to another project, landing in that project's first open column. */
export async function moveTaskToProject(taskId: string, projectId: string): Promise<void> {
  const columns = await columnsOf(projectId);
  const column = columns.find((c) => !c.is_done) ?? columns[0];
  if (column) await moveTask(taskId, column.id);
}

/** Make a task a realm task: it lands in the realm's built-in task list. */
export async function moveTaskToRealm(taskId: string, areaId: string): Promise<void> {
  const area = await db.areas.get(areaId);
  if (!area || area.deleted_at) return;
  const own = (await getAreaDefault(areaId)) ?? (await createAreaDefault(area));
  await moveTaskToProject(taskId, own.id);
}

/** Toggle completion from list views by moving between open and done columns. */
export async function setTaskCompleted(task: Task, completed: boolean): Promise<void> {
  const columns = await columnsOf(task.project_id);
  const target = completed ? columns.find((c) => c.is_done) : columns.find((c) => !c.is_done);
  if (target) {
    await moveTask(task.id, target.id);
  } else {
    // No suitable column (e.g. a project with no done column): just set the flag.
    await patch('tasks', task.id, { completed_at: completed ? now() : null });
    if (completed && !task.completed_at) emitTaskCompleted(task.id);
  }
}

export async function archiveTask(id: string): Promise<void> {
  await patch('tasks', id, { archived_at: now() });
}

/** Restore from the archive. Completed tasks get a fresh 7-day window. */
export async function restoreTask(task: Task): Promise<void> {
  await patch('tasks', task.id, { archived_at: null, completed_at: task.completed_at ? now() : null });
}

async function deleteTaskTree(task: Task, t: string) {
  const steps = await db.steps.where('task_id').equals(task.id).toArray();
  await putMany('steps', steps.filter(alive).map((s) => ({ ...s, deleted_at: t })));
  const links = await db.task_labels.where('task_id').equals(task.id).toArray();
  await putMany('task_labels', links.filter(alive).map((l) => ({ ...l, deleted_at: t })));
  await patch('tasks', task.id, { deleted_at: t });
}

export async function deleteTask(id: string): Promise<void> {
  await writeTx(async () => {
    const task = await db.tasks.get(id);
    if (task) await deleteTaskTree(task, now());
  });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export async function stepsOf(taskId: string): Promise<Step[]> {
  return (await db.steps.where('task_id').equals(taskId).toArray()).filter(alive).sort(byPosition);
}

export async function addStep(taskId: string, text: string): Promise<void> {
  const steps = await stepsOf(taskId);
  await put('steps', { ...newRow(), task_id: taskId, text: titleCase(text), is_done: false, position: keyAtEnd(steps) });
}

export const updateStep = (id: string, changes: Partial<Step>) =>
  patch('steps', id, changes.text === undefined ? changes : { ...changes, text: titleCase(changes.text) });

export const deleteStep = (id: string) => patch('steps', id, { deleted_at: now() });

export async function moveStep(taskId: string, id: string, dir: -1 | 1): Promise<void> {
  await moveInList('steps', await stepsOf(taskId), id, dir);
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export async function createLabel(name: string, color: string | null = null): Promise<Label> {
  const label: Label = { ...newRow(), name, color };
  await put('labels', label);
  return label;
}

export const updateLabel = (id: string, changes: Partial<Label>) => patch('labels', id, changes);

export async function deleteLabel(id: string): Promise<void> {
  const t = now();
  await writeTx(async () => {
    const links = await db.task_labels.where('label_id').equals(id).toArray();
    await putMany('task_labels', links.filter(alive).map((l) => ({ ...l, deleted_at: t })));
    await patch('labels', id, { deleted_at: t });
  });
}

/**
 * Tag a task by name from the task itself: reuses an existing tag with the
 * same name (ignoring case) or creates it, then applies it.
 */
export async function tagTask(taskId: string, name: string, color: string | null): Promise<void> {
  const wanted = name.trim();
  if (!wanted) return;
  const existing = (await db.labels.toArray()).find(
    (l) => alive(l) && l.name.trim().toLowerCase() === wanted.toLowerCase(),
  );
  const label = existing ?? (await createLabel(wanted, color));
  await setTaskLabel(taskId, label.id, true);
}

export async function setTaskLabel(taskId: string, labelId: string, on: boolean): Promise<void> {
  const existing = await db.task_labels.get([taskId, labelId]);
  const t = now();
  await put('task_labels', {
    task_id: taskId,
    label_id: labelId,
    user_id: currentUserId(),
    created_at: existing?.created_at ?? t,
    updated_at: t,
    deleted_at: on ? null : t,
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(changes: Partial<Settings>): Promise<void> {
  await patch('settings', currentUserId(), changes);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function moveInList(
  table: 'areas' | 'board_columns' | 'steps',
  sorted: { id: string; position: string }[],
  id: string,
  dir: -1 | 1,
) {
  const from = sorted.findIndex((r) => r.id === id);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= sorted.length) return;
  const rest = sorted.filter((r) => r.id !== id);
  await patch(table, id, { position: keyAtIndex(rest, to) });
}
