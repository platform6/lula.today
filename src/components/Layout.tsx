import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { moveTaskToRealm } from '../db/actions';
import { useAreas, useInboxCount, useProjects, useSettings } from '../db/hooks';
import type { Area } from '../db/types';
import { onNotice } from '../lib/celebrate';
import { isRealProject } from '../lib/paths';
import { byPosition } from '../lib/position';
import { ArchiveIcon, BriefcaseIcon, CalendarIcon, ClockIcon, WitchHatIcon, ListIcon, NodesIcon, PencilIcon, PlusIcon, SearchIcon, SlidersIcon, SunIcon } from './icons';
import { BrandLockup } from './Brand';
import { Celebration } from './Celebration';
import { ConfirmCompleteProvider } from './ConfirmComplete';
import { Branch, Children, NODE_SIZE, Stem, TreeNode } from './NodeTree';
import { QuickAdd } from './QuickAdd';
import { SyncBadge } from './SyncBadge';
import { TaskSheet } from './TaskSheet';
import { TimerBar } from './Timer';
import { useOpenTask } from './useOpenTask';
import { RealmExpansionAll, RealmExpansionProvider, RealmToggle, useRealmExpansion } from './RealmExpansion';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/** Drag payloads shared by the Inbox list (source) and realm drop targets. */
export type InboxDragData = { type: 'inbox-task'; id: string; title: string };
type RealmDropData = { type: 'realm'; areaId: string; name: string };

// Drop on whatever is under the finger/pointer; fall back to overlap.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

export function Layout() {
  const [quickAdd, setQuickAdd] = useState(false);
  const [params] = useSearchParams();
  const taskId = params.get('task');
  const openTask = useOpenTask();
  const navigate = useNavigate();
  const onListsPage = useLocation().pathname.startsWith('/lists');
  const theme = useSettings()?.theme;
  const [dragging, setDragging] = useState<InboxDragData | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Inbox rows start dragging on a short mouse move or a press-and-hold on touch,
  // so taps and scrolling keep working.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    // The installed app's status bar takes this color.
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f7f7f5' : '#111316');
    try {
      localStorage.setItem('lula.theme', theme); // read by index.html to avoid a flash on launch
    } catch {
      // storage unavailable; the synced setting still applies after load
    }
  }, [theme]);

  // Desktop shortcuts: n = new task, / = search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === 'n') {
        e.preventDefault();
        setQuickAdd(true);
      } else if (e.key === '/') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const showToast = (text: string) => {
    clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  // e.g. "Done · next one Wed, Oct 28" when a recurring task moves on
  useEffect(() => onNotice(showToast), []);

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as InboxDragData | undefined;
    if (data?.type === 'inbox-task') setDragging(data);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    const task = active.data.current as InboxDragData | undefined;
    const realm = over?.data.current as RealmDropData | undefined;
    if (task?.type !== 'inbox-task' || realm?.type !== 'realm') return;
    void moveTaskToRealm(task.id, realm.areaId).then(() => showToast(`Moved to ${realm.name}`));
  };

  return (
    <RealmExpansionProvider>
    <ConfirmCompleteProvider>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragCancel={() => setDragging(null)}
        onDragEnd={onDragEnd}
      >
        <div className="flex h-full">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="pt-safe min-h-0 flex-1 overflow-y-auto pb-56 md:pb-8">
              <Outlet />
            </main>
            <TimerBar variant="dock" />
            <BottomNav />
          </div>

          {!dragging && !onListsPage && (
            <button
              className="fixed right-4 bottom-[calc(8.875rem+var(--tab-safe))] z-30 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-fg shadow-xl shadow-black/40 md:right-6 md:bottom-6"
              onClick={() => setQuickAdd(true)}
              aria-label="Add task"
            >
              <PlusIcon width={32} height={32} strokeWidth={2.75} />
            </button>
          )}

          {dragging && <RealmDropBar />}

          {quickAdd && (
            <QuickAdd
              onClose={() => setQuickAdd(false)}
              onCreated={(id, openDetails) => {
                setQuickAdd(false);
                if (openDetails) openTask(id);
              }}
            />
          )}
          {taskId && <TaskSheet id={taskId} onClose={() => openTask(null)} />}
          <Celebration />

          {toast && (
            <div
              role="status"
              className="fixed top-[calc(env(safe-area-inset-top)+4.5rem)] left-1/2 z-50 -translate-x-1/2 rounded-md border-2 border-accent bg-surface px-5 py-3 text-base font-bold shadow-2xl"
            >
              {toast}
            </div>
          )}
        </div>

        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div className="card max-w-xs border-2 border-accent px-4 py-3 text-base font-semibold shadow-2xl">
              {dragging.title}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </ConfirmCompleteProvider>
    </RealmExpansionProvider>
  );
}

/** Appears while dragging an Inbox task: one large drop target per realm. */
function RealmDropBar() {
  const areas = useAreas() ?? [];
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent bg-surface p-3 shadow-2xl md:left-72">
      <p className="mb-2 text-base font-bold">Drop on a realm</p>
      {areas.length === 0 ? (
        <p className="text-base text-fg-2">Create a realm first (Realms tab).</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {areas.map((a) => (
            <RealmDropTarget key={a.id} area={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function RealmDropTarget({ area }: { area: Area }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `realm-bar:${area.id}`,
    data: { type: 'realm', areaId: area.id, name: area.name } satisfies RealmDropData,
  });
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-16 items-center gap-3 rounded-md border-2 border-l-8 px-3 text-lg font-bold transition-colors ${isOver ? 'border-accent bg-accent/20' : 'border-line-strong bg-surface-2'}`}
      style={{ borderLeftColor: area.color ?? 'var(--line-strong)' }}
    >
      <span className="min-w-0 truncate">{area.name}</span>
    </div>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-base font-semibold ${isActive ? 'bg-surface-2 text-fg shadow-[inset_3px_0_0_var(--accent)]' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`;

// Compact tree geometry for the sidebar (row heights in px).
const SIDE_ROOT_H = 44;
const SIDE_REALM_H = 40;
const SIDE_PROJECT_H = 36;

function Sidebar() {
  const { collapsed, toggle } = useRealmExpansion();
  const areas = useAreas() ?? [];
  const projects = (useProjects() ?? []).filter((p) => isRealProject(p) && !p.archived_at).sort(byPosition);
  const orphans = projects.filter((p) => !areas.some((a) => a.id === p.area_id));
  const inboxCount = useInboxCount();

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex items-center justify-between px-4 py-4">
        <NavLink to="/" aria-label="lula, go to Today">
          <BrandLockup size={36} />
        </NavLink>
        <SyncBadge />
      </div>
      <TimerBar variant="side" />
      <nav className="mt-2 flex flex-col gap-0.5 px-2">
        <NavLink to="/" end className={navClass}><SunIcon /> Today</NavLink>
        <NavLink to="/calendar" className={navClass}><CalendarIcon /> Calendar</NavLink>
        <NavLink to="/work" className={navClass}><BriefcaseIcon /> Work log</NavLink>
        <NavLink to="/time" className={navClass}><ClockIcon /> Time</NavLink>
        <NavLink to="/inbox" className={navClass}>
          <WitchHatIcon /> <span className="flex-1">Sorting</span>
          <CountBadge count={inboxCount} />
        </NavLink>
        <NavLink to="/tasks" className={navClass}><ListIcon /> All tasks</NavLink>
        <NavLink to="/search" className={navClass}><SearchIcon /> Search</NavLink>
        <NavLink to="/archive" className={navClass}><ArchiveIcon /> Archive</NavLink>
      </nav>
      <div className="mt-4 flex-1 overflow-y-auto border-t border-line px-4 pt-3 pb-4">
        <div className="relative flex items-center">
        <NavLink
          to="/realms"
          end
          className={({ isActive }) =>
            `relative flex flex-1 items-center gap-3 rounded-sm text-base font-bold ${isActive ? 'text-accent' : 'text-fg hover:text-accent'}`
          }
          style={{ height: SIDE_ROOT_H }}
        >
          <TreeNode kind="root" compact />
          Realms
          {areas.length > 0 && <Stem x={NODE_SIZE.compactRoot / 2} y={SIDE_ROOT_H / 2} />}
        </NavLink>
        <RealmExpansionAll ids={areas.filter((a) => projects.some((p) => p.area_id === a.id)).map((a) => a.id)} />
        </div>
        <Children x={NODE_SIZE.compactRoot / 2}>
          {areas.map((area, i) => {
            const mine = projects.filter((p) => p.area_id === area.id);
            const expanded = !collapsed.has(area.id);
            return (
              <Branch key={area.id} last={i === areas.length - 1} y={SIDE_REALM_H / 2} indent={18}>
                <SidebarRealm area={area} hasChildren={mine.length > 0} expanded={expanded} onToggle={() => toggle(area.id)} />
                {mine.length > 0 && expanded && (
                  <Children x={NODE_SIZE.compactRealm / 2}>
                    {mine.map((p, j) => (
                      <Branch key={p.id} last={j === mine.length - 1} y={SIDE_PROJECT_H / 2} indent={16} color={area.color}>
                        <NavLink
                          to={`/projects/${p.id}`}
                          className={({ isActive }) =>
                            `flex items-center gap-2 rounded-sm pr-2 text-sm font-semibold ${isActive ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:text-fg'}`
                          }
                          style={{ height: SIDE_PROJECT_H }}
                        >
                          <TreeNode kind="project" color={area.color} compact />
                          <span className="truncate">{p.name}</span>
                        </NavLink>
                      </Branch>
                    ))}
                  </Children>
                )}
              </Branch>
            );
          })}
        </Children>
        <NavLink to="/lists" className={({ isActive }) => `mt-4 border-t border-line pt-3 ${navClass({ isActive })}`}><PencilIcon /> Lists</NavLink>
        {orphans.length > 0 && (
          <NavLink to="/realms" className="mt-3 block rounded-sm border-2 border-warn px-3 py-2 text-sm font-semibold text-warn">
            {orphans.length} project{orphans.length === 1 ? ' needs' : 's need'} a realm
          </NavLink>
        )}
      </div>
      <nav className="border-t border-line p-2">
        <NavLink to="/settings" className={navClass}><SlidersIcon /> Settings</NavLink>
        <p className="px-3 pt-1 font-mono text-[0.6875rem] text-muted" title={`Built ${new Date(__BUILD_TIME__).toLocaleString()}`}>
          {__APP_VERSION__}
        </p>
      </nav>
    </aside>
  );
}

/** A realm node in the sidebar; also a drop target for Inbox tasks. */
function SidebarRealm({ area, hasChildren, expanded, onToggle }: { area: Area; hasChildren: boolean; expanded: boolean; onToggle: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `realm-side:${area.id}`,
    data: { type: 'realm', areaId: area.id, name: area.name } satisfies RealmDropData,
  });
  return (
    <div ref={setNodeRef} className="relative flex items-center" style={{ height: SIDE_REALM_H }}>
      <NavLink
        to={`/realms/${area.id}`}
        className={({ isActive }) =>
          `flex h-full min-w-0 flex-1 items-center gap-3 rounded-sm pr-2 text-base font-semibold ${isOver ? 'bg-accent/20 text-fg outline-2 outline-accent' : isActive ? 'bg-surface-2 text-fg' : 'text-fg-2 hover:text-fg'}`
        }
      >
        <TreeNode kind="realm" color={area.color} compact />
        <span className="truncate">{area.name}</span>
      </NavLink>
      {hasChildren && <RealmToggle name={area.name} expanded={expanded} onClick={onToggle} />}
      {hasChildren && expanded && <Stem x={NODE_SIZE.compactRealm / 2} y={SIDE_REALM_H / 2} color={area.color} />}
    </div>
  );
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="grid min-w-6 place-items-center rounded-full bg-accent px-1.5 text-xs font-bold text-accent-fg">
      {count > 99 ? '99+' : count}
    </span>
  );
}

const tabClass = (isActive: boolean) =>
  `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 pt-4 text-xs font-semibold ${isActive ? 'text-accent shadow-[inset_0_3px_0_var(--accent)]' : 'text-fg-2'}`;

const tabIcon = { width: 26, height: 26 };

function BottomNav() {
  const inboxCount = useInboxCount();
  const { pathname } = useLocation();
  // Realm pages and the boards inside them all belong to the Realms tab.
  const inRealms = pathname.startsWith('/realms') || pathname.startsWith('/projects');
  // On phones the calendar, work log and time are reached from Today (time also from the timer), so they belong to that tab.
  const inToday = pathname === '/' || ['/calendar', '/work', '/time'].some((p) => pathname.startsWith(p));
  return (
    <nav className="pb-tabbar fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-line bg-surface md:hidden">
      <NavLink to="/" end className={() => tabClass(inToday)}><SunIcon {...tabIcon} /> Today</NavLink>
      <NavLink to="/inbox" className={({ isActive }) => tabClass(isActive)}>
        <span className="relative">
          <WitchHatIcon {...tabIcon} />
          <span className="absolute -top-2 -right-4">
            <CountBadge count={inboxCount} />
          </span>
        </span>
        Sorting
      </NavLink>
      <NavLink to="/realms" className={() => tabClass(inRealms)}><NodesIcon {...tabIcon} /> Realms</NavLink>
      <NavLink to="/lists" className={({ isActive }) => tabClass(isActive)}><PencilIcon {...tabIcon} /> Lists</NavLink>
      <NavLink to="/search" className={({ isActive }) => tabClass(isActive)}><SearchIcon {...tabIcon} /> Search</NavLink>
      <NavLink to="/settings" className={({ isActive }) => tabClass(isActive)}><SlidersIcon {...tabIcon} /> Settings</NavLink>
    </nav>
  );
}
