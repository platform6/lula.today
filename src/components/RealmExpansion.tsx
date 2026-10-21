import { createContext, useContext, useState, type ReactNode } from 'react';
import { ChevronRightIcon, CollapseAllIcon, DownIcon, ExpandAllIcon } from './icons';

const RealmExpansionContext = createContext<{
  collapsed: Set<string>;
  toggle: (id: string) => void;
  collapseAll: (ids: string[]) => void;
  expandAll: () => void;
} | null>(null);

/** Keep the two realm trees in step while navigating the app. */
export function RealmExpansionProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  return (
    <RealmExpansionContext.Provider value={{ collapsed, toggle, collapseAll: (ids) => setCollapsed(new Set(ids)), expandAll: () => setCollapsed(new Set()) }}>
      {children}
    </RealmExpansionContext.Provider>
  );
}

export function useRealmExpansion() {
  const value = useContext(RealmExpansionContext);
  if (!value) throw new Error('Realm expansion requires RealmExpansionProvider');
  return value;
}

export function RealmToggle({ name, expanded, onClick }: { name: string; expanded: boolean; onClick: () => void }) {
  const label = `${expanded ? 'Collapse' : 'Expand'} ${name} projects`;
  return (
    <button type="button" onClick={onClick} aria-expanded={expanded} aria-label={label} title={label}
      className="grid h-10 w-10 shrink-0 place-items-center rounded-sm text-fg-2 hover:bg-surface-2 hover:text-fg">
      {expanded ? <DownIcon /> : <ChevronRightIcon />}
    </button>
  );
}

export function RealmExpansionAll({ ids }: { ids: string[] }) {
  const { collapsed, collapseAll, expandAll } = useRealmExpansion();
  if (!ids.length) return null;
  const allCollapsed = ids.every((id) => collapsed.has(id));
  const label = allCollapsed ? 'Expand all' : 'Collapse all';
  return (
    <button type="button" aria-label={label} title={label}
      className="ml-auto grid h-11 w-11 shrink-0 place-items-center rounded-sm text-fg-2 hover:bg-surface-2 hover:text-fg"
      onClick={() => allCollapsed ? expandAll() : collapseAll(ids)}>
      {allCollapsed ? <ExpandAllIcon /> : <CollapseAllIcon />}
    </button>
  );
}
