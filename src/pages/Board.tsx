import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createTask, moveTask } from '../db/actions';
import { useAreas, useColumns, useLabels, useProject, useProjectTasks, useProjects, useStepCounts, useTaskLabelMap } from '../db/hooks';
import { TreeNode } from '../components/NodeTree';
import type { BoardColumn, Label, Task } from '../db/types';
import { PRIORITY_BARS, isLive } from '../lib/tasks';
import { PageHeader } from '../components/PageHeader';
import { TaskMeta } from '../components/TaskMeta';
import { BackIcon, PlusIcon, SlidersIcon } from '../components/icons';
import { useOpenTask } from '../components/useOpenTask';
import { useConfirmComplete } from '../components/ConfirmComplete';

type DragData = { type: 'task' | 'column'; columnId: string };

/**
 * The column under the pointer gets the drop, wherever in the column it is;
 * within it, the nearest card decides the position. Plain closestCorners let a
 * card in the next column win over the middle of a tall, mostly empty column.
 */
const collision: CollisionDetection = (args) => {
  const column = pointerWithin(args).find((h) => (h.data?.droppableContainer.data.current as DragData | undefined)?.type === 'column');
  if (!column) return closestCorners(args); // keyboard drags, or the pointer outside every column
  const columnId = (column.data!.droppableContainer.data.current as DragData).columnId;
  return closestCorners({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => (c.data.current as DragData | undefined)?.columnId === columnId),
  });
};

const HIDE_DONE_KEY = 'lula.board.hideDone';

export function Board() {
  const { id } = useParams();
  return <ProjectBoard projectId={id!} />;
}

/** Opening a realm lands on the board of its own tasks; options are one tap away. */
export function RealmBoard() {
  const { id } = useParams();
  const projects = useProjects();
  if (!projects) return null;
  const own = projects.find((p) => p.is_area_default && p.area_id === id);
  if (!own) return <p className="p-4 text-base text-muted">Realm not found. If you just created it elsewhere, sync first.</p>;
  return <ProjectBoard projectId={own.id} />;
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
  // The column a drop would land in right now, for the drag highlight.
  const [overColumn, setOverColumn] = useState<string | null>(null);
  // Phones show one full-width column at a time; tabs above track and jump between them.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeCol, setActiveCol] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);

  // Keep the current column's tab in view when the tab row is wider than the screen.
  useEffect(() => {
    const tab = tabsRef.current?.children[activeCol] as HTMLElement | undefined;
    tab?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
  }, [activeCol]);
  const confirmComplete = useConfirmComplete();
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
    setOverColumn(null);
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
    const task = tasks?.find((t) => t.id === active.id);
    const completing = !!task && !task.completed_at && !!columns?.find((c) => c.id === target)?.is_done;
    void (async () => {
      // the card snaps back while the dialog is open; it moves once confirmed
      if (completing && !(await confirmComplete(task))) return;
      await moveTask(String(active.id), target, index);
    })();
  }

  // The column nearest the middle of the scroller is the one in view.
  function onColumnsScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best !== activeCol) setActiveCol(best);
  }

  function goToColumn(i: number) {
    const el = scrollerRef.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: 'smooth' });
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
            // a realm's board goes back to all realms; a project's board goes back to its realm
            <Link
              to={project.is_area_default ? '/realms' : `/realms/${area.id}`}
              className="btn-ghost -ml-2 px-2"
              aria-label={project.is_area_default ? 'All realms' : `Back to ${area.name}`}
            >
              <BackIcon />
            </Link>
          )
        }
        title={
          <span className="flex min-w-0 flex-col leading-tight">
            {area && !project.is_area_default && (
              <Link to={`/realms/${area.id}`} className="flex items-center gap-1.5 text-sm font-semibold text-fg-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: area.color ?? 'var(--line-strong)' }} />
                {area.name} ›
              </Link>
            )}
            <span className="flex min-w-0 items-center gap-2">
              {project.is_area_default && (
                <span className="flex shrink-0 p-1">
                  <TreeNode kind="realm" color={area?.color} compact />
                </span>
              )}
              <span className="truncate">
                {project.is_inbox ? 'Sorting board' : project.is_area_default ? (area?.name ?? project.name) : project.name}
              </span>
              {project.completed_at && <span className="chip text-ok">Completed</span>}
            </span>
          </span>
        }
        toolbar={
          <>
            <button className="btn-outline min-h-10 px-3 text-sm" onClick={toggleHideDone} aria-pressed={hideDone}>
              {hideDone ? 'Show done' : 'Hide done'}
            </button>
            {project.is_area_default && area ? (
              <Link to={`/realms/${area.id}/options`} className="btn-outline min-h-10 px-3 text-sm">
                <SlidersIcon width={18} height={18} /> Options
              </Link>
            ) : (
              <Link to={`/projects/${project.id}/settings`} className="btn-outline min-h-10 px-3 text-sm">
                <SlidersIcon width={18} height={18} /> Settings
              </Link>
            )}
          </>
        }
      />
      {columns.length > 1 && (
        <div
          ref={tabsRef}
          className="flex overflow-x-auto border-b border-line px-2 [scrollbar-width:none] md:hidden"
          role="tablist"
          aria-label="Columns"
        >
          {columns.map((c, i) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={i === activeCol}
              onClick={() => goToColumn(i)}
              className={`flex min-h-12 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold ${i === activeCol ? 'text-fg shadow-[inset_0_-3px_0_var(--accent)]' : 'text-fg-2'}`}
            >
              {c.name}
              <span className="chip">{byColumn.get(c.id)?.length ?? 0}</span>
            </button>
          ))}
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragOver={({ over }) => setOverColumn((over?.data.current as DragData | undefined)?.columnId ?? null)}
        onDragCancel={() => {
          setActiveId(null);
          setOverColumn(null);
        }}
        onDragEnd={onDragEnd}
      >
        <div
          ref={scrollerRef}
          onScroll={onColumnsScroll}
          className="relative flex flex-1 snap-x snap-mandatory gap-3 overflow-x-auto p-4 max-md:[scrollbar-width:none] md:snap-none"
        >
          {columns.map((c) => (
            <Column
              key={c.id}
              column={c}
              highlight={overColumn === c.id}
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
  highlight,
  tasks,
  projectId,
  stepCounts,
  labelsFor,
}: {
  column: BoardColumn;
  /** A dragged card would land in this column. */
  highlight: boolean;
  tasks: Task[];
  projectId: string;
  stepCounts: Map<string, [number, number]> | undefined;
  labelsFor: (taskId: string) => Label[];
}) {
  const { setNodeRef } = useDroppable({
    id: `col:${column.id}`,
    data: { type: 'column', columnId: column.id } satisfies DragData,
  });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');

  return (
    // The whole column, heading included, is the drop target.
    <section
      ref={setNodeRef}
      className={`flex w-full shrink-0 snap-center flex-col rounded-md transition-colors md:w-80 ${highlight ? 'bg-accent/10 outline-2 outline-offset-4 outline-accent outline-dashed' : ''}`}
    >
      <div className={`mb-3 flex items-center gap-2 border-b-2 px-1 pb-2 ${highlight ? 'border-accent' : 'border-line-strong'}`}>
        <h2 className={`text-lg font-bold ${highlight ? 'text-accent' : ''}`}>{column.name}</h2>
        <span className="chip">{tasks.length}</span>
        {column.is_done && <span className="text-sm font-bold text-ok">✓ Done</span>}
      </div>
      <div className="flex min-h-28 flex-1 flex-col gap-2.5 rounded-md p-1">
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
