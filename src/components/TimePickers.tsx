import { useState, type ReactNode } from 'react';
import { ensureTimeTag, ensureTimeTask } from '../db/time';
import { nameKey } from '../lib/time';
import { CheckIcon, ChevronRightIcon, PlusIcon, SearchIcon } from './icons';
import type { TimeLookup } from './useTimeLookup';

// The Project, Task and Tag pickers, shared by the entry sheet and the timer.

export function Group({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line rounded-md border border-line bg-surface-2">{children}</div>;
}

export function PickRow({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-surface" onClick={onClick}>
      <span className="shrink-0 text-base">{label}</span>
      <span className="flex min-w-0 flex-1 justify-end text-base text-fg-2">{children}</span>
      <ChevronRightIcon className="shrink-0 text-fg-2" />
    </button>
  );
}

export function Dot({ color }: { color: string | null }) {
  return <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color ?? 'var(--line-strong)' }} />;
}

type Item = { id: string; label: string; color?: string | null; group?: string };

/**
 * A searchable list to pick from, as in Clockify: a "Without …" row, the items
 * (grouped when they have a group), and a row to create what was searched for.
 */
function Picker({
  search,
  none,
  items,
  isSelected,
  onPick,
  onCreate,
  children,
}: {
  search: string;
  none?: { label: string; selected: boolean; onPick: () => void };
  items: Item[];
  isSelected: (id: string) => boolean;
  onPick: (id: string) => void;
  onCreate?: (name: string) => void;
  /** Shown between the search and the list (e.g. tabs). */
  children?: ReactNode;
}) {
  const [query, setQuery] = useState('');
  const key = nameKey(query);
  const shown = key ? items.filter((i) => nameKey(`${i.group ?? ''} ${i.label}`).includes(key)) : items;
  const exact = items.some((i) => nameKey(i.label) === key);

  const groups: [string | undefined, Item[]][] = [];
  for (const item of shown) {
    const last = groups[groups.length - 1];
    if (last && last[0] === item.group) last[1].push(item);
    else groups.push([item.group, [item]]);
  }

  const row = 'flex min-h-14 w-full items-center gap-3 px-4 text-left text-base hover:bg-surface';
  const check = (on: boolean) => (on ? <CheckIcon className="shrink-0 text-accent" width={22} height={22} /> : null);

  return (
    <div className="flex flex-col gap-3 p-4">
      <label className="relative block">
        <span className="sr-only">{search}</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-fg-2" />
        <input autoFocus className="input pl-10" placeholder={search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {children}
      {none && !key && (
        <button className={`${row} rounded-md border border-line bg-surface-2`} onClick={none.onPick}>
          <span className="flex-1">{none.label}</span>
          {check(none.selected)}
        </button>
      )}
      {onCreate && key && !exact && (
        <button className={`${row} rounded-md border border-line bg-surface-2 font-semibold`} onClick={() => onCreate(query.trim())}>
          <PlusIcon className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">Create “{query.trim()}”</span>
        </button>
      )}
      {groups.map(([group, list], i) => (
        <div key={`${group ?? ''}-${i}`}>
          {group && <h3 className="px-1 pb-1 text-sm font-semibold text-fg-2">{group}</h3>}
          <div className="divide-y divide-line rounded-md border border-line bg-surface-2">
            {list.map((item) => (
              <button key={item.id} className={row} onClick={() => onPick(item.id)}>
                {item.color !== undefined && <Dot color={item.color} />}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {check(isSelected(item.id))}
              </button>
            ))}
          </div>
        </div>
      ))}
      {shown.length === 0 && !(onCreate && key) && <p className="px-1 text-base text-fg-2">Nothing matches.</p>}
    </div>
  );
}

export function ProjectPicker({ lookup, selected, onPick }: { lookup: TimeLookup; selected: string; onPick: (id: string) => void }) {
  const projects = [...lookup.timeProjects];
  // Keep an entry's project pickable even if it no longer tracks time.
  const current = selected ? lookup.projects.get(selected) : undefined;
  if (current && !projects.some((p) => p.id === current.id)) projects.unshift(current);

  const items: Item[] = projects.map((p) => {
    const realm = p.area_id ? lookup.areas.get(p.area_id)?.name : undefined;
    return {
      id: p.id,
      label: p.is_area_default ? (realm ?? p.name) : p.name,
      color: lookup.projectColor(p.id),
      group: realm ?? 'No realm',
    };
  });

  return (
    <Picker
      search="Search projects"
      none={{ label: 'Without project', selected: !selected, onPick: () => onPick('') }}
      items={items}
      isSelected={(id) => id === selected}
      onPick={onPick}
    >
      {lookup.timeProjects.length === 0 && (
        <p className="text-base text-fg-2">
          No project tracks time yet. Tick <b>Time tracking</b> in a realm’s or project’s options to pick it here.
        </p>
      )}
    </Picker>
  );
}

export function TaskPicker({
  lookup,
  projectId,
  selected,
  onPick,
}: {
  lookup: TimeLookup;
  projectId: string | null;
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  const tasks = lookup.tasksOf(projectId);
  const current = selected ? lookup.tasks.get(selected) : undefined;
  if (current && !tasks.some((t) => t.id === current.id)) tasks.unshift(current);

  return (
    <Picker
      search="Search"
      none={{ label: 'Without task', selected: !selected, onPick: () => onPick(null) }}
      items={tasks.map((t) => ({ id: t.id, label: t.name }))}
      isSelected={(id) => id === selected}
      onPick={onPick}
      onCreate={(name) => void ensureTimeTask(projectId, name).then((t) => onPick(t.id))}
    >
      <p className="text-sm text-fg-2">
        {projectId ? <>Tasks in {lookup.projectLabel(projectId)}</> : 'Tasks with no project. Pick a project first to see its tasks.'}
      </p>
    </Picker>
  );
}

export function TagPicker({ lookup, selected, onToggle }: { lookup: TimeLookup; selected: string[]; onToggle: (id: string) => void }) {
  const [archived, setArchived] = useState(false);
  const tags = [...lookup.tags.values()].filter((t) => !!t.archived_at === archived);
  const tab = (on: boolean) =>
    `min-h-11 flex-1 rounded-sm text-base font-semibold ${on ? 'bg-surface text-fg shadow' : 'text-fg-2'}`;

  return (
    <Picker
      search="Search"
      items={tags.map((t) => ({ id: t.id, label: t.name }))}
      isSelected={(id) => selected.includes(id)}
      onPick={onToggle}
      onCreate={
        archived
          ? undefined
          : (name) =>
              void ensureTimeTag(name).then((t) => {
                if (!selected.includes(t.id)) onToggle(t.id);
              })
      }
    >
      <div className="flex gap-1 rounded-md border border-line bg-surface-2 p-1" role="tablist" aria-label="Tags">
        <button role="tab" aria-selected={!archived} className={tab(!archived)} onClick={() => setArchived(false)}>Active</button>
        <button role="tab" aria-selected={archived} className={tab(archived)} onClick={() => setArchived(true)}>Archived</button>
      </div>
    </Picker>
  );
}
