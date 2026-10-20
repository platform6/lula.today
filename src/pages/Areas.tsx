import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createArea, setProjectArea } from '../db/actions';
import { useAllTasks, useAreas, useProjects } from '../db/hooks';
import { isRealProject } from '../lib/paths';
import { isLive } from '../lib/tasks';
import { COLORS } from '../components/ColorPicker';
import { PageHeader } from '../components/PageHeader';
import { ArchiveIcon, ListIcon } from '../components/icons';

/** Top level of the hierarchy: the ongoing kinds of work. */
export function Areas() {
  const areas = useAreas();
  const projects = useProjects();
  const tasks = useAllTasks();
  const [name, setName] = useState('');

  if (!areas || !projects) return null;

  const projectArea = new Map(projects.map((p) => [p.id, p.area_id]));
  const openByArea = new Map<string, number>();
  for (const t of tasks ?? []) {
    const areaId = projectArea.get(t.project_id);
    if (areaId && isLive(t) && !t.completed_at) openByArea.set(areaId, (openByArea.get(areaId) ?? 0) + 1);
  }
  const active = projects.filter((p) => isRealProject(p) && !p.archived_at);
  const orphans = active.filter((p) => !areas.some((a) => a.id === p.area_id));

  return (
    <div>
      <PageHeader title="Areas" />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        {orphans.length > 0 && (
          <section className="card border-2 border-warn p-4">
            <h2 className="text-lg font-bold">Projects that need an area</h2>
            <p className="mt-1 text-base text-fg-2">Every project now lives inside an area. Choose one for each:</p>
            <ul className="mt-3 flex flex-col gap-2">
              {orphans.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 font-semibold">{p.name}</span>
                  <select
                    className="input w-auto"
                    value=""
                    onChange={(e) => e.target.value && void setProjectArea(p.id, e.target.value)}
                    aria-label={`Area for ${p.name}`}
                  >
                    <option value="" disabled>
                      Choose an area…
                    </option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {areas.length === 0 && <p className="mt-2 text-base text-fg-2">Add an area below first.</p>}
          </section>
        )}

        {areas.length === 0 && (
          <p className="text-base text-fg-2">
            Areas are the kinds of work in your life, such as Work, Home or Health. Add your first one below.
          </p>
        )}

        <ul className="flex flex-col gap-3">
          {areas.map((a) => {
            const projectCount = active.filter((p) => p.area_id === a.id).length;
            const open = openByArea.get(a.id) ?? 0;
            return (
              <li key={a.id}>
                <Link
                  to={`/areas/${a.id}`}
                  className="card flex min-h-20 items-center gap-4 border-l-8 px-4 py-3 hover:bg-surface-2"
                  style={{ borderLeftColor: a.color ?? 'var(--line-strong)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xl font-bold">{a.name}</div>
                    <div className="mt-0.5 text-sm text-fg-2">
                      {open} open task{open === 1 ? '' : 's'} · {projectCount} project{projectCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <span className="text-2xl text-fg-2" aria-hidden="true">›</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = name.trim();
            if (v) void createArea(v, COLORS[areas.length % COLORS.length]);
            setName('');
          }}
        >
          <input className="input" placeholder="New area (e.g. Work, Home, Health)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={!name.trim()}>Add area</button>
        </form>

        <div className="flex gap-2 md:hidden">
          <Link to="/tasks" className="btn-outline flex-1"><ListIcon /> All tasks</Link>
          <Link to="/archive" className="btn-outline flex-1"><ArchiveIcon /> Archive</Link>
        </div>
      </div>
    </div>
  );
}
