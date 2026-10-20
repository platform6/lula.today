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
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted">
      {task.priority > 0 && (
        <span className={`flex items-center gap-0.5 ${PRIORITY_COLORS[task.priority]}`} title={`${PRIORITY_LABELS[task.priority]} priority`}>
          <FlagIcon width={12} height={12} />
          {PRIORITY_LABELS[task.priority]}
        </span>
      )}
      {task.due_at && (
        <span className={overdue ? 'text-danger' : ''}>{formatDue(task.due_at, task.due_has_time)}</span>
      )}
      {steps && steps[1] > 0 && (
        <span className={steps[0] === steps[1] ? 'text-emerald-400' : ''}>
          ☑ {steps[0]}/{steps[1]}
        </span>
      )}
      {task.url && <LinkIcon width={12} height={12} />}
      {labels?.map((l) => (
        <span
          key={l.id}
          className="rounded-full px-1.5 py-px text-[11px]"
          style={{ background: `color-mix(in srgb, ${l.color ?? 'var(--muted)'} 22%, transparent)`, color: l.color ?? undefined }}
        >
          {l.name}
        </span>
      ))}
    </div>
  );
}
