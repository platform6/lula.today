import { useState } from 'react';
import { setTaskCompleted } from '../db/actions';
import { useAllColumns, useAreaMap, useLabels, useProjects, useStepCounts, useTaskLabelMap } from '../db/hooks';
import type { Task } from '../db/types';
import { placeOf } from '../lib/paths';
import { CheckIcon } from './icons';
import { MoveToSheet } from './MoveToSheet';
import { PlaceTag } from './PlaceTag';
import { TaskMeta } from './TaskMeta';
import { useOpenTask } from './useOpenTask';

/** A flat list of tasks with a completion checkbox, used by list views. */
export function TaskList({
  tasks,
  showPlace = true,
  showMove = false,
  empty,
}: {
  tasks: Task[];
  showPlace?: boolean;
  /** Inbox mode: a prominent "Move to…" action on each row. */
  showMove?: boolean;
  empty?: string;
}) {
  const openTask = useOpenTask();
  const columns = useAllColumns();
  const projects = useProjects() ?? [];
  const areaMap = useAreaMap();
  const stepCounts = useStepCounts();
  const labels = useLabels() ?? [];
  const labelMap = useTaskLabelMap();
  const [moving, setMoving] = useState<Task | null>(null);

  if (tasks.length === 0) return empty ? <p className="px-4 py-4 text-base text-muted">{empty}</p> : null;

  return (
    <>
      <ul className="divide-y divide-line">
        {tasks.map((task) => {
          const done = !!task.completed_at || !!columns?.get(task.column_id)?.is_done;
          const place = placeOf(
            projects.find((p) => p.id === task.project_id),
            areaMap,
          );
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
                {showPlace && place && (
                  <div className="mt-1.5">
                    <PlaceTag place={place} />
                  </div>
                )}
              </button>
              {showMove && (
                <button className="btn-outline shrink-0 px-3" onClick={() => setMoving(task)}>
                  Move
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {moving && <MoveToSheet taskId={moving.id} title={moving.title} onClose={() => setMoving(null)} />}
    </>
  );
}
