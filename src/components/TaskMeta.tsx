import type { Label, Task } from '../db/types';
import { formatDue, isOverdue } from '../lib/dates';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/tasks';
import { FlagIcon, LinkIcon } from './icons';

/** Compact badges shown on cards and list rows. */
export function TaskMeta({
  task,
  steps,
  labels,
  done,
}: {
  task: Task;
  steps?: [number, number];
  labels?: Label[];
  done?: boolean;
}) {
  const overdue = !done && isOverdue(task.due_at, task.due_has_time);
  const hasAny = task.priority > 0 || task.due_at || task.url || (steps && steps[1] > 0) || labels?.length;
  if (!hasAny) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm font-medium text-fg-2">
      {task.priority > 0 && (
        <span className={`flex items-center gap-1 font-bold ${PRIORITY_COLORS[task.priority]}`} title={`${PRIORITY_LABELS[task.priority]} priority`}>
          <FlagIcon width={16} height={16} strokeWidth={2.5} />
          {PRIORITY_LABELS[task.priority]}
        </span>
      )}
      {task.due_at && (
        <span className={overdue ? 'font-bold text-danger' : ''}>
          {overdue && 'Overdue · '}
          {formatDue(task.due_at, task.due_has_time)}
        </span>
      )}
      {steps && steps[1] > 0 && (
        <span className={steps[0] === steps[1] ? 'text-ok' : ''}>
          {steps[0]}/{steps[1]} steps
        </span>
      )}
      {task.url && (
        <span className="flex items-center gap-1">
          <LinkIcon width={16} height={16} /> Link
        </span>
      )}
      {labels?.map((l) => (
        <span key={l.id} className="chip border-l-3" style={{ borderLeftColor: l.color ?? 'var(--muted)' }}>
          {l.name}
        </span>
      ))}
    </div>
  );
}
