import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MiniSearch from 'minisearch';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Task } from '../db/types';
import { isArchived } from '../lib/tasks';
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
  const projectHits = q
    ? (data?.projects ?? []).filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
    : [];

  return (
    <div>
      <PageHeader title="Search" />
      <div className="p-4">
        <input
          autoFocus
          type="search"
          className="input"
          placeholder="Search tasks, notes, steps, links, labels…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          enterKeyHint="search"
        />
      </div>
      {projectHits.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {projectHits.map((p) => (
            <Link key={p.id} to={p.is_inbox ? '/inbox' : `/projects/${p.id}`} className="card flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-sm" style={{ background: p.color ?? 'var(--line)' }} />
              {p.name}
            </Link>
          ))}
        </div>
      )}
      {q && <TaskList tasks={live} empty={archived.length ? undefined : 'No matches.'} />}
      {archived.length > 0 && (
        <section className="mt-4 opacity-70">
          <h2 className="px-4 text-xs font-semibold tracking-wide text-muted uppercase">Archived · {archived.length}</h2>
          <TaskList tasks={archived} />
        </section>
      )}
    </div>
  );
}
