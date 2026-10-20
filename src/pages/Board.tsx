import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createTask, moveTask } from '../db/actions';
import { useAreas, useColumns, useLabels, useProject, useProjectTasks, useStepCounts, useTaskLabelMap } from '../db/hooks';
import type { BoardColumn, Label, Task } from '../db/types';
import { PRIORITY_BARS, isLive } from '../lib/tasks';
import { PageHeader } from '../components/PageHeader';
import { TaskMeta } from '../components/TaskMeta';
import { BackIcon, GearIcon, PlusIcon } from '../components/icons';
import { useOpenTask } from '../components/useOpenTask';

type DragData = { type: 'task' | 'column'; columnId: string };

const HIDE_DONE_KEY = 'lula.board.hideDone';

export function Board() {
  const { id } = useParams();
  return <ProjectBoard projectId={id!} />;
}

export function ProjectBoard({ projectId }: { projectId: string }) {
  const project = useProject(projectId);
  const areas = useAreas();
  const area = project?.area_id ? areas?.find((a) => a.id === project.area_id) : undefined;
  const columns = useColumns(projectId);
  const tasks = useProjectTasks(projectId);
  const stepCounts = useStepCounts();
  const labels = useLabels() ?? [];
  const labelMap = useTaskLabelMap();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(() => {
    try {
      return localStorage.getItem(HIDE_DONE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // A short press-and-hold starts a drag so normal swipes still scroll the board.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const c of columns ?? []) map.set(c.id, []);
    for (const t of tasks ?? []) {
      if (!isLive(t)) continue;
      if (hideDone && t.completed_at) continue;
      map.get(t.column_id)?.push(t);
    }
    return map;
  }, [columns, tasks, hideDone]);

  if (project === undefined || columns === undefined) return null;
  if (project === null) return <p className="p-4 text-muted">Project not found.</p>;

  const labelsFor = (taskId: string) =>
    (labelMap?.get(taskId) ?? []).map((lid) => labels.find((l) => l.id === lid)).filter((l): l is Label => !!l);

  const activeTask = activeId ? tasks?.find((t) => t.id === activeId) : undefined;

  function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const data = over.data.current as DragData | undefined;
    if (!data) return;
    const target = data.columnId;
    const list = (byColumn.get(target) ?? []).filter((t) => t.id !== active.id);
    let index = list.length;
    if (data.type === 'task') {
      const overIndex = list.findIndex((t) => t.id === over.id);
      if (overIndex !== -1) {
        const rect = active.rect.current.translated;
        const below = rect ? rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2 : false;
        index = overIndex + (below ? 1 : 0);
      }
    }
    const source = byColumn.get(String((active.data.current as DragData).columnId)) ?? [];
    const originalIndex = source.findIndex((t) => t.id === active.id);
    if ((active.data.current as DragData).columnId === target && originalIndex === index) return;
    void moveTask(String(active.id), target, index);
  }

  const toggleHideDone = () => {
    setHideDone((v) => {
      try {
        localStorage.setItem(HIDE_DONE_KEY, v ? '0' : '1');
      } catch {
        // per-viewer convenience only
      }
      return !v;
    });
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        back={
          area && (
            <Link to={`/areas/${area.id}`} className="btn-ghost -ml-2 px-2" aria-label={`Back to ${area.name}`}>
              <BackIcon />
            </Link>
          )
        }
        title={
          <span className="flex min-w-0 flex-col leading-tight">
            {area && !project.is_area_default && (
              <Link to={`/areas/${area.id}`} className="flex items-center gap-1.5 text-sm font-semibold text-fg-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: area.color ?? 'var(--line-strong)' }} />
                {area.name} ›
              </Link>
            )}
            <span className="truncate">
              {project.is_inbox ? 'Inbox board' : project.is_area_default ? `${area?.name ?? project.name} tasks` : project.name}
              {project.completed_at && <span className="chip ml-2 align-middle text-ok">Completed</span>}
            </span>
          </span>
        }
        actions={
          <>
            <button className="btn-ghost px-2 text-sm" onClick={toggleHideDone}>
              {hideDone ? 'Show done' : 'Hide done'}
            </button>
            <Link to={`/projects/${project.id}/settings`} className="btn-ghost px-2" aria-label="Project settings">
              <GearIcon />
            </Link>
          </>
        }
      />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragCancel={() => setActiveId(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-4 md:snap-none">
          {columns.map((c) => (
            <Column
              key={c.id}
              column={c}
              tasks={byColumn.get(c.id) ?? []}
              projectId={project.id}
              stepCounts={stepCounts}
              labelsFor={labelsFor}
            />
          ))}
          {columns.length === 0 && (
            <p className="text-muted">
              No columns yet. <Link className="text-accent" to={`/projects/${project.id}/settings`}>Add some in project settings.</Link>
            </p>
          )}
        </div>
        <DragOverlay>
          {activeTask && (
            <CardBody
              task={activeTask}
              steps={stepCounts?.get(activeTask.id)}
              labels={labelsFor(activeTask.id)}
              className="rotate-2 shadow-2xl"
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({
  column,
  tasks,
  projectId,
  stepCounts,
  labelsFor,
}: {
  column: BoardColumn;
  tasks: Task[];
  projectId: string;
  stepCounts: Map<string, [number, number]> | undefined;
  labelsFor: (taskId: string) => Label[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${column.id}`,
    data: { type: 'column', columnId: column.id } satisfies DragData,
  });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  return (
    <section className="flex w-[88vw] max-w-sm shrink-0 snap-center flex-col md:w-80">
      <div className="mb-3 flex items-center gap-2 border-b-2 border-line-strong px-1 pb-2">
        <h2 className="text-lg font-bold">{column.name}</h2>
        <span className="chip">{tasks.length}</span>
        {column.is_done && <span className="text-sm font-bold text-ok">✓ Done</span>}
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-28 flex-1 flex-col gap-2.5 rounded-md p-1 transition-colors ${isOver ? 'bg-accent/15 outline-2 outline-accent outline-dashed' : ''}`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <Card key={t.id} task={t} done={column.is_done} steps={stepCounts?.get(t.id)} labels={labelsFor(t.id)} />
          ))}
        </SortableContext>
        {adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = title.trim();
              if (v) void createTask({ title: v, project_id: projectId, column_id: column.id });
              setTitle('');
            }}
          >
            <input
              autoFocus
              className="input"
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !title.trim() && setAdding(false)}
              onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
              enterKeyHint="done"
            />
          </form>
        ) : (
          <button className="btn-ghost justify-start" onClick={() => setAdding(true)}>
            <PlusIcon width={22} height={22} /> Add task
          </button>
        )}
      </div>
    </section>
  );
}

function Card({
  task,
  done,
  steps,
  labels,
}: {
  task: Task;
  done: boolean;
  steps?: [number, number];
  labels: Label[];
}) {
  const openTask = useOpenTask();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', columnId: task.column_id } satisfies DragData,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={isDragging ? 'opacity-30' : ''}
      {...attributes}
      {...listeners}
      onClick={() => openTask(task.id)}
    >
      <CardBody task={task} steps={steps} labels={labels} done={done} />
    </div>
  );
}

function CardBody({
  task,
  steps,
  labels,
  done,
  className = '',
}: {
  task: Task;
  steps?: [number, number];
  labels: Label[];
  done?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`card cursor-pointer border-l-4 px-3.5 py-3 select-none hover:bg-surface-2 ${PRIORITY_BARS[task.priority]} ${className}`}
    >
      <div className={`text-base font-semibold break-words ${done ? 'text-muted line-through' : 'text-fg'}`}>{task.title}</div>
      <TaskMeta task={task} steps={steps} labels={labels} done={done} />
    </div>
  );
}
