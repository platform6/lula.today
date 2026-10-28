import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useDroppable } from '@dnd-kit/core';
import { useAreas, useInboxCount, useProjects } from '../db/hooks';
import type { Area } from '../db/types';
import { isRealProject } from '../lib/paths';
import { byPosition } from '../lib/position';
import { remember, remembered } from '../lib/stored';
import { ArchiveIcon, BackIcon, BriefcaseIcon, CalendarIcon, ChevronRightIcon, ClockIcon, DownIcon, WitchHatIcon, ListIcon, PencilIcon, SearchIcon, SlidersIcon, SunIcon } from './icons';
import { BrandLockup } from './Brand';
import { CountBadge } from './CountBadge';
import type { RealmDropData } from './dragData';
import { Branch, Children, NODE_SIZE, Stem, TreeNode } from './NodeTree';
import { RealmExpansionAll, RealmToggle, useRealmExpansion } from './RealmExpansion';
import { SyncBadge } from './SyncBadge';
import { TimerBar } from './Timer';

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

export function Sidebar() {
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
