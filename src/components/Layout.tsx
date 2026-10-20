import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAreas, useInboxCount, useProjects, useSettings } from '../db/hooks';
import { isRealProject } from '../lib/paths';
import { ArchiveIcon, FolderIcon, GearIcon, InboxIcon, ListIcon, PlusIcon, SearchIcon, SunIcon } from './icons';
import { Celebration } from './Celebration';
import { QuickAdd } from './QuickAdd';
import { SyncBadge } from './SyncBadge';
import { TaskSheet } from './TaskSheet';
import { useOpenTask } from './useOpenTask';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

export function Layout() {
  const [quickAdd, setQuickAdd] = useState(false);
  const [params] = useSearchParams();
  const taskId = params.get('task');
  const openTask = useOpenTask();
  const navigate = useNavigate();
  const theme = useSettings()?.theme;

  useEffect(() => {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
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

  return (
    <div className="flex h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="pt-safe min-h-0 flex-1 overflow-y-auto pb-40 md:pb-8">
          <Outlet />
        </main>
        <BottomNav />
      </div>

      <button
        className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 grid h-16 w-16 place-items-center rounded-full bg-accent text-accent-fg shadow-xl shadow-black/40 md:right-6 md:bottom-6"
        onClick={() => setQuickAdd(true)}
        aria-label="Add task"
      >
        <PlusIcon width={32} height={32} strokeWidth={2.75} />
      </button>

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
    </div>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-sm px-3 py-2 text-base font-semibold ${isActive ? 'bg-surface-2 text-fg shadow-[inset_3px_0_0_var(--accent)]' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`;

function Sidebar() {
  const areas = useAreas() ?? [];
  const projects = (useProjects() ?? []).filter((p) => isRealProject(p) && !p.archived_at);
  const orphans = projects.filter((p) => !areas.some((a) => a.id === p.area_id));
  const inboxCount = useInboxCount();

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-r border-line bg-surface md:flex">
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-2xl font-bold text-accent">lula</span>
        <SyncBadge />
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        <NavLink to="/" end className={navClass}><SunIcon /> Today</NavLink>
        <NavLink to="/inbox" className={navClass}>
          <InboxIcon /> <span className="flex-1">Inbox</span>
          <CountBadge count={inboxCount} />
        </NavLink>
        <NavLink to="/tasks" className={navClass}><ListIcon /> All tasks</NavLink>
        <NavLink to="/search" className={navClass}><SearchIcon /> Search</NavLink>
        <NavLink to="/archive" className={navClass}><ArchiveIcon /> Archive</NavLink>
      </nav>
      <div className="mt-4 flex-1 overflow-y-auto border-t border-line px-2 pt-3">
        <NavLink to="/areas" end className={navClass}><FolderIcon /> Areas</NavLink>
        {areas.map((area) => (
          <div key={area.id} className="mt-2">
            <NavLink to={`/areas/${area.id}`} className={navClass}>
              <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: area.color ?? 'var(--muted)' }} />
              <span className="truncate">{area.name}</span>
            </NavLink>
            <div className="ml-5 border-l-2 border-line pl-1">
              {projects
                .filter((p) => p.area_id === area.id)
                .map((p) => (
                  <ProjectLink key={p.id} id={p.id} name={p.name} />
                ))}
            </div>
          </div>
        ))}
        {orphans.length > 0 && (
          <NavLink to="/areas" className="mt-3 block rounded-sm border-2 border-warn px-3 py-2 text-sm font-semibold text-warn">
            {orphans.length} project{orphans.length === 1 ? ' needs' : 's need'} an area
          </NavLink>
        )}
      </div>
      <nav className="border-t border-line p-2">
        <NavLink to="/settings" className={navClass}><GearIcon /> Settings</NavLink>
      </nav>
    </aside>
  );
}

function ProjectLink({ id, name }: { id: string; name: string }) {
  return (
    <NavLink
      to={`/projects/${id}`}
      className={({ isActive }) =>
        `flex min-h-10 items-center rounded-sm px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-surface-2 text-fg shadow-[inset_3px_0_0_var(--accent)]' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'}`
      }
    >
      <span className="truncate">{name}</span>
    </NavLink>
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
  `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold ${isActive ? 'text-accent shadow-[inset_0_3px_0_var(--accent)]' : 'text-fg-2'}`;

const tabIcon = { width: 26, height: 26 };

function BottomNav() {
  const inboxCount = useInboxCount();
  const { pathname } = useLocation();
  // Area pages and the boards inside them all belong to the Areas tab.
  const inAreas = pathname.startsWith('/areas') || pathname.startsWith('/projects');
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 flex border-t-2 border-line bg-surface md:hidden">
      <NavLink to="/" end className={({ isActive }) => tabClass(isActive)}><SunIcon {...tabIcon} /> Today</NavLink>
      <NavLink to="/inbox" className={({ isActive }) => tabClass(isActive)}>
        <span className="relative">
          <InboxIcon {...tabIcon} />
          <span className="absolute -top-2 -right-4">
            <CountBadge count={inboxCount} />
          </span>
        </span>
        Inbox
      </NavLink>
      <NavLink to="/areas" className={() => tabClass(inAreas)}><FolderIcon {...tabIcon} /> Areas</NavLink>
      <NavLink to="/search" className={({ isActive }) => tabClass(isActive)}><SearchIcon {...tabIcon} /> Search</NavLink>
      <NavLink to="/settings" className={({ isActive }) => tabClass(isActive)}><GearIcon {...tabIcon} /> Settings</NavLink>
    </nav>
  );
}
