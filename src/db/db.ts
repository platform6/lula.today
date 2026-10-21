import Dexie, { type Table } from 'dexie';
import type {
  Area,
  ExperienceList,
  ListItem,
  BoardColumn,
  BusPurchase,
  Label,
  OutboxEntry,
  Project,
  Settings,
  Step,
  SyncTable,
  TableRows,
  Task,
  TaskLabel,
  WorkDay,
} from './types';

export class LulaDB extends Dexie {
  lists!: Table<ExperienceList, string>;
  list_items!: Table<ListItem, string>;
  areas!: Table<Area, string>;
  projects!: Table<Project, string>;
  board_columns!: Table<BoardColumn, string>;
  tasks!: Table<Task, string>;
  steps!: Table<Step, string>;
  labels!: Table<Label, string>;
  task_labels!: Table<TaskLabel, [string, string]>;
  settings!: Table<Settings, string>;
  work_days!: Table<WorkDay, string>;
  bus_purchases!: Table<BusPurchase, string>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('lula');
    this.version(1).stores({
      areas: 'id',
      projects: 'id, area_id',
      board_columns: 'id, project_id',
      tasks: 'id, project_id, column_id',
      steps: 'id, task_id',
      labels: 'id',
      task_labels: '[task_id+label_id], task_id, label_id',
      settings: 'user_id',
      outbox: '++seq, table',
      meta: 'key',
    });
    this.version(2).stores({
      work_days: 'id, day',
      bus_purchases: 'id',
    });
    this.version(3).stores({
      lists: 'id',
      list_items: 'id, list_id',
    });
  }
}

export const db = new LulaDB();

// Push order respects foreign keys: parents before children.
export const SYNC_TABLES: SyncTable[] = [
  'settings',
  'areas',
  'projects',
  'board_columns',
  'tasks',
  'steps',
  'labels',
  'task_labels',
  'work_days',
  'bus_purchases',
  'lists',
  'list_items',
];

/** Server-side conflict target for upserts. */
export const CONFLICT_TARGET: Record<SyncTable, string> = {
  lists: 'id',
  list_items: 'id',
  areas: 'id',
  projects: 'id',
  board_columns: 'id',
  tasks: 'id',
  steps: 'id',
  labels: 'id',
  task_labels: 'task_id,label_id',
  settings: 'user_id',
  work_days: 'id',
  bus_purchases: 'id',
};

/** Stable string key for a row, used by the outbox. */
export function rowKey<T extends SyncTable>(table: T, row: TableRows[T]): string {
  if (table === 'task_labels') {
    const r = row as TaskLabel;
    return `${r.task_id}|${r.label_id}`;
  }
  if (table === 'settings') return (row as Settings).user_id;
  return (row as { id: string }).id;
}

/** Dexie primary key from an outbox string key. */
export function dexieKey(table: SyncTable, key: string): string | [string, string] {
  if (table === 'task_labels') {
    const [task_id, label_id] = key.split('|');
    return [task_id, label_id];
  }
  return key;
}

export function syncTable<T extends SyncTable>(table: T): Table<TableRows[T], unknown> {
  return db.table(table);
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}
