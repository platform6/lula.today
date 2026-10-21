import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { createArea, moveAreaTo, setProjectArea } from '../db/actions';
import { useAllTasks, useAreas, useProjectProgress, useProjects } from '../db/hooks';
import { isRealProject } from '../lib/paths';
import { byPosition } from '../lib/position';
import { isLive } from '../lib/tasks';
import { COLORS } from '../components/ColorPicker';
import { Branch, Children, NODE_SIZE, Stem, TreeNode } from '../components/NodeTree';
import { PageHeader } from '../components/PageHeader';
import { ArchiveIcon, GripIcon, ListIcon } from '../components/icons';
import type { Area } from '../db/types';

// Row heights (px) for the tree; connectors meet each row's vertical center.
const ROOT_H = 48;
const REALM_H = 60;
const PROJECT_H = 44;

/** Top of the hierarchy, drawn as a node tree: Realms → realm → project. */
export function Areas() {
  const areas = useAreas();
  const projects = useProjects();
  const tasks = useAllTasks();
  const progress = useProjectProgress();
  const [name, setName] = useState('');
  // Realms reorder by dragging their grip; taps and scrolling elsewhere are unaffected.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!areas || !projects) return null;

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const to = areas.findIndex((a) => a.id === over.id);
    if (to !== -1) void moveAreaTo(String(active.id), to);
  };

  const projectArea = new Map(projects.map((p) => [p.id, p.area_id]));
  const openByArea = new Map<string, number>();
  for (const t of tasks ?? []) {
    const areaId = projectArea.get(t.project_id);
    if (areaId && isLive(t) && !t.completed_at) openByArea.set(areaId, (openByArea.get(areaId) ?? 0) + 1);
  }
  const active = projects.filter((p) => isRealProject(p) && !p.archived_at).sort(byPosition);
  const orphans = active.filter((p) => !areas.some((a) => a.id === p.area_id));

  return (
    <div>
      <PageHeader title="Realms" />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        {orphans.length > 0 && (
          <section className="card border-2 border-warn p-4">
            <h2 className="text-lg font-bold">Projects that need a realm</h2>
            <p className="mt-1 text-base text-fg-2">Every project now lives inside a realm. Choose one for each:</p>
            <ul className="mt-3 flex flex-col gap-2">
              {orphans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-semibold">{p.name}</span>
                  <select
                    className="input w-auto"
                    value=""
                    onChange={(e) => e.target.value && void setProjectArea(p.id, e.target.value)}
                    aria-label={`Realm for ${p.name}`}
                  >
                    <option value="" disabled>
                      Choose a realm…
                    </option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {areas.length === 0 && <p className="mt-2 text-base text-fg-2">Add a realm below first.</p>}
          </section>
        )}

        <div>
          {/* root */}
          <div className="relative flex items-center gap-3" style={{ height: ROOT_H }}>
            <TreeNode kind="root" compact />
            <span className="text-xl font-bold">Realms</span>
            <span className="chip">{areas.length}</span>
            {areas.length > 0 && <Stem x={NODE_SIZE.compactRoot / 2} y={ROOT_H / 2} />}
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={areas.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <Children x={NODE_SIZE.compactRoot / 2}>
                {areas.map((a, i) => {
                  const mine = active.filter((p) => p.area_id === a.id);
                  const open = openByArea.get(a.id) ?? 0;
                  return (
                    <Branch key={a.id} last={i === areas.length - 1} y={REALM_H / 2} indent={20}>
                      <SortableRealm area={a}>
                        {(grip) => (
                          <>
                            <div className="relative flex items-center gap-3" style={{ height: REALM_H }}>
                              <TreeNode kind="realm" color={a.color} compact />
                              <Link to={`/realms/${a.id}`} className="-my-1 min-w-0 flex-1 rounded-sm px-2 py-1 hover:bg-surface-2">
                                <div className="truncate text-xl font-bold">{a.name}</div>
                                <div className="truncate text-sm text-fg-2">
                                  {open} open task{open === 1 ? '' : 's'} · {mine.length} project{mine.length === 1 ? '' : 's'}
                                </div>
                              </Link>
                              {mine.length > 0 && <Stem x={NODE_SIZE.compactRealm / 2} y={REALM_H / 2} color={a.color} />}
                              {grip}
                            </div>
                            {mine.length > 0 && (
                              <Children x={NODE_SIZE.compactRealm / 2}>
                                {mine.map((p, j) => {
                                  const [done, total] = progress?.get(p.id) ?? [0, 0];
                                  return (
                                    <Branch key={p.id} last={j === mine.length - 1} y={PROJECT_H / 2} indent={18} color={a.color}>
                                      <Link
                                        to={`/projects/${p.id}`}
                                        className="flex items-center gap-3 rounded-sm pr-2 hover:bg-surface-2"
                                        style={{ height: PROJECT_H }}
                                      >
                                        <TreeNode kind="project" color={a.color} compact />
                                        <span className="min-w-0 flex-1 truncate text-base font-semibold">{p.name}</span>
                                        <span className="shrink-0 text-sm font-semibold text-fg-2">
                                          {done}/{total}
                                        </span>
                                      </Link>
                                    </Branch>
                                  );
                                })}
                              </Children>
                            )}
                          </>
                        )}
                      </SortableRealm>
                    </Branch>
                  );
                })}
              </Children>
            </SortableContext>
          </DndContext>
        </div>

        {areas.length === 0 && (
          <p className="text-base text-fg-2">
            Realms are the kinds of work in your life, such as Work, Home or Health. Add your first one below.
          </p>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = name.trim();
            if (v) void createArea(v, COLORS[areas.length % COLORS.length]);
            setName('');
          }}
        >
          <input className="input" placeholder="New realm (e.g. Work, Home, Health)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={!name.trim()}>Add realm</button>
        </form>

        <div className="flex gap-2 md:hidden">
          <Link to="/tasks" className="btn-outline flex-1"><ListIcon /> All tasks</Link>
          <Link to="/archive" className="btn-outline flex-1"><ArchiveIcon /> Archive</Link>
        </div>
      </div>
    </div>
  );
}

/** A realm row and its projects, which move together when the realm is dragged by its grip. */
function SortableRealm({ area, children }: { area: Area; children: (grip: ReactNode) => ReactNode }) {
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: area.id });
  const grip = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${area.name}`}
      className="grid h-11 w-11 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-fg-2 hover:bg-surface-2 hover:text-fg active:cursor-grabbing"
    >
      <GripIcon />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-md ${isDragging ? 'z-10 bg-surface shadow-2xl outline-2 outline-accent' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children(grip)}
    </div>
  );
}
