// Mirrors the Postgres schema in supabase/migrations/0001_init.sql.

export interface SyncMeta {
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Row extends SyncMeta {
  id: string;
  deleted_at: string | null;
}

export interface Area extends Row {
  name: string;
  color: string | null;
  icon: string | null;
  position: string;
  archived_at: string | null;
}

export interface Project extends Row {
  area_id: string | null;
  name: string;
  color: string | null;
  description: string | null;
  due_date: string | null;
  is_inbox: boolean;
  /** The area's built-in task list; shown as the area itself, never as a project. */
  is_area_default: boolean;
  position: string;
  completed_at: string | null;
  archived_at: string | null;
}

export interface BoardColumn extends Row {
  project_id: string;
  name: string;
  is_done: boolean;
  position: string;
}

export type Priority = 0 | 1 | 2 | 3;

export interface Task extends Row {
  project_id: string;
  column_id: string;
  title: string;
  notes: string | null;
  url: string | null;
  priority: Priority;
  due_at: string | null;
  due_has_time: boolean;
  completed_at: string | null;
  archived_at: string | null;
  position: string;
}

export interface Step extends Row {
  task_id: string;
  text: string;
  is_done: boolean;
  position: string;
}

export interface Label extends Row {
  name: string;
  color: string | null;
}

export interface TaskLabel extends SyncMeta {
  task_id: string;
  label_id: string;
  deleted_at: string | null;
}

export interface ColumnTemplate {
  name: string;
  is_done: boolean;
}

export interface Settings extends SyncMeta {
  default_columns: ColumnTemplate[];
  theme: 'dark' | 'light';
}

export interface TableRows {
  areas: Area;
  projects: Project;
  board_columns: BoardColumn;
  tasks: Task;
  steps: Step;
  labels: Label;
  task_labels: TaskLabel;
  settings: Settings;
}

export type SyncTable = keyof TableRows;

export interface OutboxEntry {
  seq?: number;
  table: SyncTable;
  key: string;
}
