import type { Task } from '../db/types';

export const AUTO_ARCHIVE_DAYS = 7;
const AUTO_ARCHIVE_MS = AUTO_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;

/**
 * Archived, either explicitly or because it was completed more than 7 days ago.
 * The server's nightly job sets archived_at; this keeps the UI correct offline.
 */
export function isArchived(task: Task, now = Date.now()): boolean {
  if (task.archived_at) return true;
  return !!task.completed_at && now - Date.parse(task.completed_at) > AUTO_ARCHIVE_MS;
}

export function isLive(task: Task, now = Date.now()): boolean {
  return !task.deleted_at && !isArchived(task, now);
}

export const PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'] as const;

export const PRIORITY_COLORS = ['', 'text-prio-1', 'text-prio-2', 'text-prio-3'] as const;

/** Left accent bar on cards, keyed by priority. */
export const PRIORITY_BARS = ['border-l-line-strong', 'border-l-prio-1', 'border-l-prio-2', 'border-l-prio-3'] as const;

/** Normalize a typed URL so bare domains open correctly. */
export function normalizeUrl(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}
