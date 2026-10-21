// Mirrors the Postgres schema in supabase/migrations/ and its subsequent migrations.

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

export type RepeatPreset = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'yearly' | 'custom';

/** A repeat rule (tasks.recurrence, jsonb). Date math lives in lib/recurrence.ts. */
export interface Recurrence {
  /** Which picker option made the rule; the rule fields are what count. */
  preset: RepeatPreset;
  unit: 'day' | 'week' | 'month' | 'year';
  every: number;
  /** Weekly rules: weekdays to land on, 0 = Sunday. */
  days?: number[];
  /** Monthly rules: the same day number, or the same weekday occurrence ("3rd Wednesday"). */
  month_mode?: 'day' | 'nth';
  /** Count the next one from the due date (fixed schedule) or from completion. */
  from: 'due' | 'done';
  /** Last date (YYYY-MM-DD) an occurrence may fall on. */
  until?: string | null;
  /** Total occurrences, when the series ends after a number of times. */
  count?: number | null;
  /** Occurrences completed or skipped so far. */
  done?: number;
}

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
  /** Absent on rows synced before recurrence existed. */
  recurrence?: Recurrence | null;
  /** Dropped without being done; a cancelled task is also archived. */
  cancelled_at?: string | null;
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

export type WorkStatus = 'office' | 'remote' | 'off' | 'holiday';

/** One day of the work log (date as YYYY-MM-DD); its id is derived from the date. */
export interface WorkDay extends Row {
  day: string;
  status: WorkStatus;
}

/** Bus tickets bought (a 10-pack, or the starting balance when tracking began). */
export interface BusPurchase extends Row {
  bought_on: string;
  tickets: number;
}

export interface TableRows {
  lists: ExperienceList;
  list_items: ListItem;
  areas: Area;
  projects: Project;
  board_columns: BoardColumn;
  tasks: Task;
  steps: Step;
  labels: Label;
  task_labels: TaskLabel;
  settings: Settings;
  work_days: WorkDay;
  bus_purchases: BusPurchase;
}

export type ListKind = 'general' | 'games' | 'concerts' | 'television';

export interface ExperienceList extends Row {
  name: string;
  kind: ListKind;
  description: string | null;
}

export interface ListItem extends Row {
  list_id: string;
  title: string;
  experienced_on: string | null;
  rating: number | null;
  notes: string | null;
  url: string | null;
  details: Record<string, string>;
}

export type SyncTable = keyof TableRows;

export interface OutboxEntry {
  seq?: number;
  table: SyncTable;
  key: string;
}
