import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { setTaskCompleted } from '../db/actions';
import { useAllColumns, useAreaMap, useLabels, useProjects, useStepCounts, useTaskLabelMap } from '../db/hooks';
import type { Label, Task } from '../db/types';
import { placeOf, type Place } from '../lib/paths';
import { CheckIcon, GripIcon } from './icons';
import type { InboxDragData } from './Layout';
import { MoveToSheet } from './MoveToSheet';
import { PlaceTag } from './PlaceTag';
import { TaskMeta } from './TaskMeta';
import { useOpenTask } from './useOpenTask';
import { useConfirmComplete } from './ConfirmComplete';

/** A flat list of tasks with a completion checkbox, used by list views. */
export function TaskList({
  tasks,
  showPlace = true,
  showMove = false,
  draggable = false,
  empty,
}: {
  tasks: Task[];
  showPlace?: boolean;
  /** Inbox mode: a prominent "Move" action on each row. */
  showMove?: boolean;
  /** Inbox mode: rows can be dragged onto a realm (press and hold on touch). */
  draggable?: boolean;
  empty?: string;
}) {
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
        {tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            done={!!task.completed_at || !!columns?.get(task.column_id)?.is_done}
            place={showPlace ? placeOf(projects.find((p) => p.id === task.project_id), areaMap) : undefined}
            steps={stepCounts?.get(task.id)}
            labels={(labelMap?.get(task.id) ?? [])
              .map((id) => labels.find((l) => l.id === id))
              .filter((l): l is Label => !!l)}
            draggable={draggable}
            onMove={showMove ? () => setMoving(task) : undefined}
          />
        ))}
      </ul>
      {moving && <MoveToSheet taskId={moving.id} title={moving.title} onClose={() => setMoving(null)} />}
    </>
  );
}

function TaskRow({
  task,
  done,
  place,
  steps,
  labels,
  draggable,
  onMove,
}: {
  task: Task;
  done: boolean;
  place?: Place;
  steps?: [number, number];
  labels: Label[];
  draggable: boolean;
  onMove?: () => void;
}) {
  const openTask = useOpenTask();
  const confirmComplete = useConfirmComplete();
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `inbox:${task.id}`,
    data: { type: 'inbox-task', id: task.id, title: task.title } satisfies InboxDragData,
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      className={`flex items-start gap-3 px-4 py-4 ${draggable ? 'touch-manipulation select-none [-webkit-touch-callout:none]' : ''} ${isDragging ? 'opacity-40' : ''}`}
      {...(draggable ? { ...attributes, ...listeners } : {})}
    >
      {draggable && (
        <span className="-ml-2 self-center text-fg-2" aria-hidden="true">
          <GripIcon />
        </span>
      )}
      <button
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-sm border-2 ${done ? 'border-accent bg-accent text-accent-fg' : 'border-fg-2 hover:border-accent'}`}
        onClick={async () => {
          if (!done && !(await confirmComplete(task.title))) return;
          await setTaskCompleted(task, !done);
        }}
        aria-label={done ? 'Mark not done' : 'Mark done'}
      >
        {done && <CheckIcon width={20} height={20} strokeWidth={3.5} />}
      </button>
      {/* The whole area opens the task; the title is the keyboard-focusable control.
          Tag chips inside are their own buttons and stop the click. */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openTask(task.id)}>
        <button type="button" className={`block w-full text-left text-base font-semibold break-words ${done ? 'text-muted line-through' : 'text-fg'}`}>
          {task.title}
        </button>
        <TaskMeta task={task} steps={steps} labels={labels} done={done} />
        {place && (
          <div className="mt-1.5">
            <PlaceTag place={place} />
          </div>
        )}
      </div>
      {onMove && (
        <button className="btn-outline shrink-0 px-3" onClick={onMove}>
          Move
        </button>
      )}
    </li>
  );
}
