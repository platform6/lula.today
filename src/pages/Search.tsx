import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MiniSearch from 'minisearch';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Task } from '../db/types';
import { isArchived } from '../lib/tasks';
import { isRealProject } from '../lib/paths';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';

interface Doc {
  id: string;
  title: string;
  notes: string;
  url: string;
  steps: string;
  labels: string;
  project: string;
  area: string;
}

/** Everything searchable, read from the local database so search works offline. */
function useSearchData() {
  return useLiveQuery(async () => {
    const [tasks, steps, labels, links, projects, areas] = await Promise.all([
      db.tasks.toArray(),
      db.steps.toArray(),
      db.labels.toArray(),
      db.task_labels.toArray(),
      db.projects.toArray(),
      db.areas.toArray(),
    ]);
    return {
      tasks: tasks.filter((t) => !t.deleted_at),
      steps: steps.filter((s) => !s.deleted_at),
      labels: new Map(labels.filter((l) => !l.deleted_at).map((l) => [l.id, l.name])),
      links: links.filter((l) => !l.deleted_at),
      projects: projects.filter((p) => !p.deleted_at),
      areas: new Map(areas.filter((a) => !a.deleted_at).map((a) => [a.id, a.name])),
      areaList: areas.filter((a) => !a.deleted_at),
    };
  });
}

export function Search() {
  const data = useSearchData();
  const [query, setQuery] = useState('');

  const index = useMemo(() => {
    if (!data) return null;
    const stepsByTask = new Map<string, string[]>();
    for (const s of data.steps) stepsByTask.set(s.task_id, [...(stepsByTask.get(s.task_id) ?? []), s.text]);
    const labelsByTask = new Map<string, string[]>();
    for (const l of data.links) {
      const name = data.labels.get(l.label_id);
      if (name) labelsByTask.set(l.task_id, [...(labelsByTask.get(l.task_id) ?? []), name]);
    }
    const projectById = new Map(data.projects.map((p) => [p.id, p]));

    const mini = new MiniSearch<Doc>({
      fields: ['title', 'notes', 'url', 'steps', 'labels', 'project', 'area'],
      searchOptions: { boost: { title: 3, labels: 1.5 }, prefix: true, fuzzy: 0.2, combineWith: 'AND' },
    });
    mini.addAll(
      data.tasks.map((t) => {
        const project = projectById.get(t.project_id);
        return {
          id: t.id,
          title: t.title,
          notes: t.notes ?? '',
          url: t.url ?? '',
          steps: (stepsByTask.get(t.id) ?? []).join(' '),
          labels: (labelsByTask.get(t.id) ?? []).join(' '),
          project: project?.name ?? '',
          area: (project?.area_id && data.areas.get(project.area_id)) || '',
        };
      }),
    );
    return mini;
  }, [data]);

  const q = query.trim();
  const taskById = useMemo(() => new Map((data?.tasks ?? []).map((t) => [t.id, t])), [data]);
  const results: Task[] = q && index ? index.search(q).map((r) => taskById.get(r.id)!).filter(Boolean) : [];
  const live = results.filter((t) => !isArchived(t));
  const archived = results.filter((t) => isArchived(t));
  // Places whose names match: areas, and projects shown with their area.
  const needle = q.toLowerCase();
  const placeHits = q
    ? [
        ...(data?.areaList ?? [])
          .filter((a) => a.name.toLowerCase().includes(needle))
          .map((a) => ({ key: a.id, href: `/realms/${a.id}`, label: a.name, color: a.color })),
        ...(data?.projects ?? [])
          .filter((p) => isRealProject(p) && p.name.toLowerCase().includes(needle))
          .map((p) => ({
            key: p.id,
            href: `/projects/${p.id}`,
            label: `${data?.areas.get(p.area_id ?? '') ?? '?'} › ${p.name}`,
            color: p.color,
          })),
      ]
    : [];

  return (
    <div>
      <PageHeader title="Search" />
      <div className="p-4">
        <input
          autoFocus
          type="search"
          className="input"
          placeholder="Search tasks, notes, steps, links, tags…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
      </div>
      {placeHits.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {placeHits.map((h) => (
            <Link key={h.key} to={h.href} className="card flex min-h-11 items-center gap-2 px-3 py-2 font-semibold">
              <span className="h-3 w-3 rounded-sm" style={{ background: h.color ?? 'var(--line-strong)' }} />
              {h.label}
            </Link>
          ))}
        </div>
      )}
      {q && <TaskList tasks={live} empty={archived.length ? undefined : 'No matches.'} />}
      {archived.length > 0 && (
        <section className="mt-6">
          <h2 className="section-title mx-4 text-fg-2">
            Archived <span className="text-sm font-semibold">{archived.length}</span>
          </h2>
          <TaskList tasks={archived} />
        </section>
      )}
    </div>
  );
}
