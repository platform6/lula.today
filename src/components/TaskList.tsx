import { setTaskCompleted } from '../db/actions';
import { useAllColumns, useLabels, useProjects, useStepCounts, useTaskLabelMap } from '../db/hooks';
import type { Task } from '../db/types';
import { CheckIcon } from './icons';
import { TaskMeta } from './TaskMeta';
import { useOpenTask } from './useOpenTask';

/** A flat list of tasks with a completion checkbox, used by list views. */
export function TaskList({ tasks, showProject = true, empty }: { tasks: Task[]; showProject?: boolean; empty?: string }) {
  const openTask = useOpenTask();
  const columns = useAllColumns();
  const projects = useProjects() ?? [];
  const stepCounts = useStepCounts();
  const labels = useLabels() ?? [];
  const labelMap = useTaskLabelMap();

  if (tasks.length === 0) return empty ? <p className="px-4 py-4 text-base text-muted">{empty}</p> : null;

  return (
    <ul className="divide-y divide-line">
      {tasks.map((task) => {
        const done = !!task.completed_at || !!columns?.get(task.column_id)?.is_done;
        const project = projects.find((p) => p.id === task.project_id);
        const taskLabels = (labelMap?.get(task.id) ?? [])
          .map((id) => labels.find((l) => l.id === id))
          .filter((l): l is NonNullable<typeof l> => !!l);
        return (
          <li key={task.id} className="flex items-start gap-3 px-4 py-4">
            <button
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm border-2 ${done ? 'border-accent bg-accent text-accent-fg' : 'border-fg-2 hover:border-accent'}`}
              onClick={() => void setTaskCompleted(task, !done)}
              aria-label={done ? 'Mark not done' : 'Mark done'}
            >
              {done && <CheckIcon width={20} height={20} strokeWidth={3.5} />}
            </button>
            <button className="min-w-0 flex-1 text-left" onClick={() => openTask(task.id)}>
              <div className={`text-base font-semibold break-words ${done ? 'text-muted line-through' : 'text-fg'}`}>{task.title}</div>
              <TaskMeta task={task} steps={stepCounts?.get(task.id)} labels={taskLabels} done={done} />
              {showProject && project && (
                <div className="mt-1.5 flex items-center gap-2 text-sm text-fg-2">
                  <span className="h-3 w-3 rounded-sm" style={{ background: project.color ?? 'var(--line-strong)' }} />
                  {project.name}
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
