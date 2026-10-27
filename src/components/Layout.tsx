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
import { remember, remembered } from '../lib/stored';
import { ArchiveIcon, BackIcon, BriefcaseIcon, CalendarIcon, ChevronRightIcon, ClockIcon, DownIcon, WitchHatIcon, ListIcon, MoreIcon, NodesIcon, PencilIcon, PlusIcon, SearchIcon, SlidersIcon, SunIcon } from './icons';
import { BrandLockup } from './Brand';
import { Celebration } from './Celebration';
import { ConfirmCompleteProvider } from './ConfirmComplete';
import { Branch, Children, NODE_SIZE, Stem, TreeNode } from './NodeTree';
import { AddMenu } from './AddMenu';
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
  const [addMenu, setAddMenu] = useState(false);
  const [params] = useSearchParams();
  const taskId = params.get('task');
  const openTask = useOpenTask();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const onListsPage = pathname.startsWith('/lists');
  // The Time page shows the running timer itself, so the docked bar is left off there.
  const onTimePage = pathname === '/';
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
            {!onTimePage && <TimerBar variant="dock" />}
            <BottomNav />
          </div>

          {!dragging && !onListsPage && (
            <button
              className={`fixed right-4 ${onTimePage ? 'bottom-[calc(5.25rem+var(--tab-safe))]' : 'bottom-[calc(8.875rem+var(--tab-safe))]'} z-30 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-fg shadow-xl shadow-black/40 md:right-6 md:bottom-6`}
              onClick={() => setAddMenu(true)}
              aria-label="Add time or a task"
            >
              <PlusIcon width={32} height={32} strokeWidth={2.75} />
            </button>
          )}

          {dragging && <RealmDropBar />}

          {addMenu && (
            <AddMenu
              onClose={() => setAddMenu(false)}
              onNewTask={() => {
                setAddMenu(false);
                setQuickAdd(true);
              }}
            />
          )}
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
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t-2 border-accent bg-surface p-3 shadow-2xl md:left-[var(--side-w,18rem)]">
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

// Sidebar width in px: dragged or arrowed between the limits, remembered per device.
const SIDE_WIDTH = 320;
const SIDE_MIN = 240;
const SIDE_MAX = 480;
const SIDE_STEP = 16;
const WIDTH_KEY = 'lula.sidebar.width';
const HIDDEN_KEY = 'lula.sidebar.hidden';
const PAGES_KEY = 'lula.sidebar.pages';

const clampWidth = (w: number) => Math.min(SIDE_MAX, Math.max(SIDE_MIN, Math.round(w)));

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
  const [width, setWidth] = useState(() => clampWidth(Number(remembered(WIDTH_KEY, String(SIDE_WIDTH))) || SIDE_WIDTH));
  const [hidden, setHidden] = useState(() => remembered<string>(HIDDEN_KEY, 'no') === 'yes');
  const [pagesOpen, setPagesOpen] = useState(() => remembered<string>(PAGES_KEY, 'open') === 'open');

  const resize = (w: number) => {
    const next = clampWidth(w);
    setWidth(next);
    remember(WIDTH_KEY, String(next));
  };
  const hide = (h: boolean) => {
    setHidden(h);
    remember(HIDDEN_KEY, h ? 'yes' : 'no');
  };
  const togglePages = () => {
    setPagesOpen((o) => {
      remember(PAGES_KEY, o ? 'folded' : 'open');
      return !o;
    });
  };

  // Bars fixed beside the sidebar (the realm drop bar) start where it ends.
  useEffect(() => {
    document.documentElement.style.setProperty('--side-w', hidden ? '3.5rem' : `${width}px`);
  }, [hidden, width]);

  if (hidden) {
    return (
      <aside className="hidden w-14 shrink-0 flex-col items-center border-r border-line bg-surface py-4 md:flex">
        <button className="btn-ghost h-11 w-11 p-0" aria-label="Show sidebar" title="Show sidebar" onClick={() => hide(false)}>
          <ChevronRightIcon />
        </button>
      </aside>
    );
  }

  return (
    <aside className="relative hidden shrink-0 flex-col border-r border-line bg-surface md:flex" style={{ width }}>
      <div className="flex items-center gap-2 px-4 py-4">
        <NavLink to="/" aria-label="lula, go to Time" className="flex-1">
          <BrandLockup size={36} />
        </NavLink>
        <SyncBadge />
        <button className="btn-ghost -mr-2 h-11 w-11 shrink-0 p-0" aria-label="Hide sidebar" title="Hide sidebar" onClick={() => hide(true)}>
          <BackIcon />
        </button>
      </div>
      <TimerBar variant="side" />
      <button
        className="mx-2 mt-2 flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm font-bold text-fg-2 hover:bg-surface-2 hover:text-fg"
        aria-expanded={pagesOpen}
        aria-controls="side-pages"
        onClick={togglePages}
      >
        <span className="flex-1 text-left">Pages</span>
        {/* Folded away, the Sorting count still shows. */}
        {!pagesOpen && <CountBadge count={inboxCount} />}
        <DownIcon width={18} height={18} className={pagesOpen ? 'rotate-180' : ''} />
      </button>
      <nav id="side-pages" hidden={!pagesOpen} className="flex flex-col gap-0.5 px-2">
        <NavLink to="/" end className={navClass}><ClockIcon /> Time</NavLink>
        <NavLink to="/today" className={navClass}><SunIcon /> Today</NavLink>
        <NavLink to="/calendar" className={navClass}><CalendarIcon /> Calendar</NavLink>
        <NavLink to="/work" className={navClass}><BriefcaseIcon /> Work log</NavLink>
        <NavLink to="/inbox" className={navClass}>
          <WitchHatIcon /> <span className="flex-1">Sorting</span>
          <CountBadge count={inboxCount} />
        </NavLink>
        <NavLink to="/tasks" className={navClass}><ListIcon /> All tasks</NavLink>
        <NavLink to="/search" className={navClass}><SearchIcon /> Search</NavLink>
        <NavLink to="/archive" className={navClass}><ArchiveIcon /> Archive</NavLink>
      </nav>
      <div className={`${pagesOpen ? 'mt-4' : 'mt-1'} flex-1 overflow-y-auto border-t border-line px-4 pt-3 pb-4`}>
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
      <ResizeHandle width={width} onResize={resize} />
    </aside>
  );
}

/** The sidebar's right edge: drag, or focus and use the arrow keys, to resize; double-click to reset. */
function ResizeHandle({ width, onResize }: { width: number; onResize: (w: number) => void }) {
  const drag = useRef<{ x: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={SIDE_MIN}
      aria-valuemax={SIDE_MAX}
      tabIndex={0}
      title="Drag to resize, double-click to reset"
      className="group absolute inset-y-0 -right-1.5 z-10 w-3 cursor-col-resize touch-none outline-none"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, width };
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => drag.current && onResize(drag.current.width + e.clientX - drag.current.x)}
      onPointerUp={() => {
        drag.current = null;
        setDragging(false);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onDoubleClick={() => onResize(SIDE_WIDTH)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onResize(width - SIDE_STEP);
        else if (e.key === 'ArrowRight') onResize(width + SIDE_STEP);
        else if (e.key === 'Home') onResize(SIDE_MIN);
        else if (e.key === 'End') onResize(SIDE_MAX);
        else return;
        e.preventDefault();
      }}
    >
      <span
        className={`mx-auto block h-full w-0.5 ${dragging ? 'bg-accent' : 'bg-transparent group-hover:bg-line-strong group-focus-visible:bg-accent'}`}
      />
    </div>
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

export function CountBadge({ count }: { count: number }) {
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
  // On phones the calendar, work log and settings are reached from Today, so they belong to that tab.
  const inToday = ['/today', '/calendar', '/work', '/settings'].some((p) => pathname.startsWith(p));
  const inMore = ['/more', '/inbox', '/lists', '/tasks', '/archive'].some((p) => pathname.startsWith(p));
  return (
    <nav className="pb-tabbar fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-line bg-surface md:hidden">
      <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}><ClockIcon {...tabIcon} /> Time</NavLink>
      <NavLink to="/today" className={() => tabClass(inToday)}><SunIcon {...tabIcon} /> Today</NavLink>
      <NavLink to="/realms" className={() => tabClass(inRealms)}><NodesIcon {...tabIcon} /> Realms</NavLink>
      <NavLink to="/search" className={({ isActive }) => tabClass(isActive)}><SearchIcon {...tabIcon} /> Search</NavLink>
      <NavLink to="/more" className={() => tabClass(inMore)}>
        <span className="relative">
          <MoreIcon {...tabIcon} />
          {/* Sorting lives under More, so its count shows here. */}
          <span className="absolute -top-2 -right-4">
            <CountBadge count={inboxCount} />
          </span>
        </span>
        More
      </NavLink>
    </nav>
  );
}
