import { NavLink, useLocation } from 'react-router-dom';
import { useInboxCount } from '../db/hooks';
import { ClockIcon, MoreIcon, NodesIcon, SearchIcon, SunIcon } from './icons';
import { CountBadge } from './CountBadge';

const tabClass = (isActive: boolean) =>
  `relative flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 pt-4 text-xs font-semibold ${isActive ? 'text-accent shadow-[inset_0_3px_0_var(--accent)]' : 'text-fg-2'}`;

const tabIcon = { width: 26, height: 26 };

export function BottomNav() {
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
