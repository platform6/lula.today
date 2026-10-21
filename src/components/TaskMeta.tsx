import { useNavigate } from 'react-router-dom';
import type { Label, Task } from '../db/types';
import { formatDue, isOverdue } from '../lib/dates';
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../lib/tasks';
import { describe, describeShort } from '../lib/recurrence';
import { FlagIcon, LinkIcon, RepeatIcon } from './icons';

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
  const navigate = useNavigate();
  const overdue = !done && isOverdue(task.due_at, task.due_has_time);
  const hasAny = task.priority > 0 || task.due_at || task.recurrence || task.url || (steps && steps[1] > 0) || labels?.length;
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
      {task.recurrence && !done && (
        <span className="flex items-center gap-1" title={describe(task.recurrence, new Date(task.due_at ?? Date.now()))}>
          <RepeatIcon width={16} height={16} strokeWidth={2.5} className="text-accent" />
          {describeShort(task.recurrence)}
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
        // Tapping a tag shows every task with that tag; it never opens the task itself.
        <button
          key={l.id}
          type="button"
          className="chip min-h-8 border-l-3 hover:bg-line hover:text-fg"
          style={{ borderLeftColor: l.color ?? 'var(--muted)' }}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/tasks?tag=${l.id}`);
          }}
          onPointerDown={(e) => e.stopPropagation()} // don't start a card drag from a tag
          title={`All tasks tagged ${l.name}`}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}
