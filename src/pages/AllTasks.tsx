import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAllTasks, useAreas, useLabels, useProjects, useTaskLabelMap } from '../db/hooks';
import type { Task } from '../db/types';
import { PRIORITY_LABELS, isLive } from '../lib/tasks';
import { isRealProject } from '../lib/paths';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';
import { XIcon } from '../components/icons';

type Status = 'open' | 'done' | 'all';

const newest = (a: Task, b: Task) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
const byPriority = (a: Task, b: Task) => b.priority - a.priority;
// Undated tasks always go last.
const byDue = (a: Task, b: Task) => {
  if (a.due_at && b.due_at && a.due_at !== b.due_at) return a.due_at < b.due_at ? -1 : 1;
  return !!a.due_at === !!b.due_at ? 0 : a.due_at ? -1 : 1;
};
const then =
  (...cmps: ((a: Task, b: Task) => number)[]) =>
  (a: Task, b: Task) => {
    for (const c of cmps) {
      const r = c(a, b);
      if (r) return r;
    }
    return 0;
  };

const SORTS = {
  due: { label: 'Due date', compare: then(byDue, byPriority, newest) },
  priority: { label: 'Priority', compare: then(byPriority, byDue, newest) },
  newest: { label: 'Newest', compare: newest },
  oldest: { label: 'Oldest', compare: (a: Task, b: Task) => newest(b, a) },
  updated: { label: 'Recently changed', compare: (a: Task, b: Task) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0) },
  title: { label: 'Title (A–Z)', compare: (a: Task, b: Task) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) },
};
type SortKey = keyof typeof SORTS;

const SORT_KEY = 'lula.allTasksSort';
function readSort(): SortKey {
  try {
    const v = localStorage.getItem(SORT_KEY);
    if (v && v in SORTS) return v as SortKey;
  } catch {
    // storage unavailable: default order
  }
  return 'due';
}

export function AllTasks() {
  const tasks = useAllTasks();
  const areas = useAreas() ?? [];
  const projects = useProjects() ?? [];
  const labels = useLabels() ?? [];
  const labelMap = useTaskLabelMap();
  const [areaId, setAreaId] = useState('');
  const [projectId, setProjectId] = useState('');
  // The tag filter lives in the URL (?tag=) so tapping a tag anywhere lands here pre-filtered.
  const [params, setParams] = useSearchParams();
  const labelId = params.get('tag') ?? '';
  const setLabelId = (id: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('tag', id);
        else next.delete('tag');
        return next;
      },
      { replace: true },
    );
  const [minPriority, setMinPriority] = useState(0);
  const [status, setStatus] = useState<Status>('open');
  const [sort, setSortState] = useState<SortKey>(readSort);
  const setSort = (next: SortKey) => {
    setSortState(next);
    try {
      localStorage.setItem(SORT_KEY, next); // remembered per device
    } catch {
      // storage unavailable; the choice still applies until you leave
    }
  };

  if (!tasks) return null;

  const activeTag = labels.find((l) => l.id === labelId);

  const projectArea = new Map(projects.map((p) => [p.id, p.area_id]));
  const areaName = new Map(areas.map((a) => [a.id, a.name]));
  const visibleProjects = projects.filter((p) => isRealProject(p) && !p.archived_at && (!areaId || p.area_id === areaId));

  const filtered = tasks
    .filter((t) => isLive(t))
    .filter((t) => (status === 'open' ? !t.completed_at : status === 'done' ? !!t.completed_at : true))
    .filter((t) => !areaId || projectArea.get(t.project_id) === areaId)
    .filter((t) => !projectId || t.project_id === projectId)
    .filter((t) => !labelId || (labelMap?.get(t.id) ?? []).includes(labelId))
    .filter((t) => t.priority >= minPriority)
    .sort(SORTS[sort].compare);

  return (
    <div>
      <PageHeader title="All tasks" />
      {activeTag && (
        <div
          className="card mx-4 mt-4 flex min-h-14 items-center gap-3 border-2 border-l-8 px-4 py-2"
          style={{ borderLeftColor: activeTag.color ?? 'var(--muted)' }}
        >
          <span className="min-w-0 flex-1 text-base">
            Tagged <b className="text-fg">{activeTag.name}</b>
          </span>
          <button className="btn-outline px-3" onClick={() => setLabelId('')}>
            <XIcon width={18} height={18} /> Clear
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 p-4 min-[360px]:grid-cols-2 sm:grid-cols-5">
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as Status)} aria-label="Status">
          <option value="open">Open</option>
          <option value="done">Completed</option>
          <option value="all">All</option>
        </select>
        <select
          className="input"
          value={areaId}
          onChange={(e) => {
            setAreaId(e.target.value);
            setProjectId('');
          }}
          aria-label="Realm"
        >
          <option value="">All realms</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {visibleProjects.map((p) => (
            <option key={p.id} value={p.id}>{areaId ? p.name : `${areaName.get(p.area_id ?? '') ?? '?'} › ${p.name}`}</option>
          ))}
        </select>
        <select className="input" value={labelId} onChange={(e) => setLabelId(e.target.value)} aria-label="Tag">
          <option value="">Any tag</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        <select className="input" value={minPriority} onChange={(e) => setMinPriority(Number(e.target.value))} aria-label="Priority">
          <option value={0}>Any priority</option>
          {PRIORITY_LABELS.slice(1).map((l, i) => (
            <option key={l} value={i + 1}>{l}+</option>
          ))}
        </select>
      </div>
      <div className="mx-4 flex items-center justify-between gap-2 border-b border-line pb-2 text-sm font-bold text-fg">
        <span>
          {filtered.length} task{filtered.length === 1 ? '' : 's'}
        </span>
        <label className="flex items-center gap-2 font-semibold text-fg-2">
          Sort
          <select
            className="min-h-10 rounded-md border-2 border-line-strong bg-surface px-2 text-sm text-fg focus:border-accent focus:outline-none"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORTS[k].label}</option>
            ))}
          </select>
        </label>
      </div>
      <TaskList tasks={filtered} empty="No tasks match these filters." />
    </div>
  );
}
