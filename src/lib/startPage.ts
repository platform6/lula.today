import { useCallback, useSyncExternalStore } from 'react';
import { remember, remembered } from './stored';

// Per-device opening page. When the app is launched at "/" (the Home Screen icon,
// or typing lula.today), openOnStartPage swaps the address for the chosen page
// before the router starts. Links to other pages, and tapping Time later, are left alone.

export const START_PAGES = [
  { path: '/', label: 'Time' },
  { path: '/today', label: 'Today' },
  { path: '/inbox', label: 'Inbox' },
  { path: '/realms', label: 'Realms' },
  { path: '/tasks', label: 'All tasks' },
  { path: '/lists', label: 'Lists' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/work', label: 'Work log' },
] as const;

export type StartPage = (typeof START_PAGES)[number]['path'];

const KEY = 'lula.startPage';
const listeners = new Set<() => void>();

export function readStartPage(): StartPage {
  const v = remembered<string>(KEY, '/');
  return START_PAGES.some((p) => p.path === v) ? (v as StartPage) : '/';
}

export function useStartPage(): [StartPage, (page: StartPage) => void] {
  const page = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, readStartPage);
  const set = useCallback((next: StartPage) => {
    remember(KEY, next);
    listeners.forEach((l) => l());
  }, []);
  return [page, set];
}

/** Where a launch at this address should go instead, or null to stay. */
export function startRedirect(loc: { pathname: string; search: string; hash: string }, start: StartPage): string | null {
  // A search or hash at "/" is a sign-in or password-reset link; leave it for auth.
  if (loc.pathname !== '/' || loc.search || loc.hash) return null;
  return start === '/' ? null : start;
}

/** Call once at launch, before the router reads the address. */
export function openOnStartPage() {
  const to = startRedirect(window.location, readStartPage());
  if (to) window.history.replaceState(window.history.state, '', to);
}
