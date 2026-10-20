import { useState } from 'react';
import { Link } from 'react-router-dom';
import { createArea, createProject, deleteArea, moveArea, updateArea } from '../db/actions';
import { useAllTasks, useAreas, useProjects } from '../db/hooks';
import type { Area, Project } from '../db/types';
import { isLive } from '../lib/tasks';
import { ColorPicker } from '../components/ColorPicker';
import { PageHeader } from '../components/PageHeader';
import { ArchiveIcon, DownIcon, ListIcon, PlusIcon, UpIcon } from '../components/icons';

export function Projects() {
  const areas = useAreas();
  const projects = useProjects();
  const tasks = useAllTasks();
  const [newArea, setNewArea] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  if (!areas || !projects) return null;

  const openCount = new Map<string, number>();
  for (const t of tasks ?? []) {
    if (isLive(t) && !t.completed_at) openCount.set(t.project_id, (openCount.get(t.project_id) ?? 0) + 1);
  }

  const active = projects.filter((p) => !p.archived_at && !p.is_inbox);
  const archived = projects.filter((p) => p.archived_at && !p.is_inbox);
  const ungrouped = active.filter((p) => !p.area_id || !areas.some((a) => a.id === p.area_id));

  return (
    <div>
      <PageHeader title="Areas & projects" />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
        <div className="flex gap-2 md:hidden">
          <Link to="/tasks" className="btn-ghost card flex-1"><ListIcon /> All tasks</Link>
          <Link to="/archive" className="btn-ghost card flex-1"><ArchiveIcon /> Archive</Link>
        </div>

        {areas.map((area, i) => (
          <AreaSection
            key={area.id}
            area={area}
            first={i === 0}
            last={i === areas.length - 1}
            projects={active.filter((p) => p.area_id === area.id)}
            openCount={openCount}
          />
        ))}

        <AreaSection projects={ungrouped} openCount={openCount} />

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = newArea.trim();
            if (v) void createArea(v, '#7c8cff');
            setNewArea('');
          }}
        >
          <input className="input" placeholder="New area (e.g. Work, Home, Health)" value={newArea} onChange={(e) => setNewArea(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={!newArea.trim()}>Add area</button>
        </form>

        {archived.length > 0 && (
          <div>
            <button className="btn-ghost" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide' : 'Show'} archived projects ({archived.length})
            </button>
            {showArchived && (
              <ul className="card mt-2 divide-y divide-line">
                {archived.map((p) => (
                  <ProjectRow key={p.id} project={p} count={openCount.get(p.id) ?? 0} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AreaSection({
  area,
  projects,
  openCount,
  first,
  last,
}: {
  area?: Area;
  projects: Project[];
  openCount: Map<string, number>;
  first?: boolean;
  last?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!area && projects.length === 0) return null;

  return (
    <section className="card">
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="h-3 w-3 rounded-full" style={{ background: area?.color ?? 'var(--line)' }} />
        <h2 className="flex-1 font-semibold">{area?.name ?? 'No area'}</h2>
        {area && (
          <>
            <button className="btn-ghost px-2 text-xs" onClick={() => setEditing((v) => !v)}>{editing ? 'Done' : 'Edit'}</button>
            <button className="btn-ghost px-2" onClick={() => setAdding(true)} aria-label="Add project"><PlusIcon /></button>
          </>
        )}
      </div>

      {area && editing && (
        <div className="flex flex-col gap-3 border-t border-line px-4 py-3">
          <input
            className="input"
            defaultValue={area.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== area.name) void updateArea(area.id, { name: v });
            }}
          />
          <ColorPicker value={area.color} onChange={(color) => void updateArea(area.id, { color })} />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-ghost" disabled={first} onClick={() => void moveArea(area.id, -1)}><UpIcon /> Up</button>
            <button className="btn-ghost" disabled={last} onClick={() => void moveArea(area.id, 1)}><DownIcon /> Down</button>
            <div className="flex-1" />
            {confirmDelete ? (
              <>
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button className="btn-danger" onClick={() => void deleteArea(area.id)}>Delete area</button>
              </>
            ) : (
              <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
            )}
          </div>
          {confirmDelete && <p className="text-xs text-muted">Projects in this area are kept and moved to “No area”.</p>}
        </div>
      )}

      <ul className="divide-y divide-line border-t border-line">
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} count={openCount.get(p.id) ?? 0} />
        ))}
        {area && projects.length === 0 && !adding && (
          <li className="px-4 py-3 text-sm text-muted">No projects yet.</li>
        )}
        {adding && area && (
          <li className="px-4 py-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const v = name.trim();
                if (v) void createProject({ name: v, area_id: area.id, color: area.color });
                setName('');
                setAdding(false);
              }}
            >
              <input
                autoFocus
                className="input"
                placeholder="Project name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => !name.trim() && setAdding(false)}
              />
            </form>
          </li>
        )}
      </ul>
    </section>
  );
}

function ProjectRow({ project, count }: { project: Project; count: number }) {
  return (
    <li>
      <Link to={`/projects/${project.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: project.color ?? 'var(--line)' }} />
        <span className="flex-1 truncate">{project.name}</span>
        <span className="text-sm text-muted">{count}</span>
      </Link>
    </li>
  );
}
