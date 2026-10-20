import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  areaDeleteBlocker,
  createProject,
  createTask,
  deleteArea,
  moveArea,
  reopenProject,
  updateArea,
} from '../db/actions';
import { useAreas, useProjectProgress, useProjectTasks, useProjects } from '../db/hooks';
import type { Area, Project } from '../db/types';
import { isRealProject } from '../lib/paths';
import { byPosition } from '../lib/position';
import { isLive } from '../lib/tasks';
import { ColorPicker } from '../components/ColorPicker';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';
import { BackIcon, DownIcon, PlusIcon, UpIcon } from '../components/icons';

/** An area: its own tasks first, then its projects. */
export function AreaPage() {
  const { id } = useParams();
  const areas = useAreas();
  const projects = useProjects();
  const area = areas?.find((a) => a.id === id);
  const own = projects?.find((p) => p.is_area_default && p.area_id === id);
  const ownTasks = useProjectTasks(own?.id);
  const progress = useProjectProgress();
  const [editing, setEditing] = useState(false);

  if (!areas || !projects) return null;
  if (!area) return <p className="p-4 text-base text-muted">Area not found.</p>;

  const index = areas.findIndex((a) => a.id === area.id);
  const mine = projects.filter((p) => p.area_id === area.id && isRealProject(p)).sort(byPosition);
  const active = mine.filter((p) => !p.archived_at);
  const finished = mine.filter((p) => p.archived_at);
  const open = (ownTasks ?? []).filter((t) => isLive(t) && !t.completed_at).sort(byPosition);

  return (
    <div>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: area.color ?? 'var(--line-strong)' }} />
            {area.name}
          </span>
        }
        back={
          <Link to="/areas" className="btn-ghost -ml-2 px-2" aria-label="All areas">
            <BackIcon />
          </Link>
        }
        actions={
          <button className="btn-ghost px-3 text-sm" onClick={() => setEditing((v) => !v)}>
            {editing ? 'Done' : 'Edit'}
          </button>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-8 py-4">
        {editing && <AreaEditor area={area} first={index === 0} last={index === areas.length - 1} />}

        <section>
          <div className="section-title mx-4">
            <span className="flex-1">{area.name} tasks</span>
            {own && (
              <Link to={`/projects/${own.id}`} className="text-sm font-semibold text-accent">
                Board view
              </Link>
            )}
          </div>
          <p className="mx-4 mt-2 text-sm text-fg-2">Tasks that belong to {area.name} but not to a project.</p>
          {own && <AddAreaTask projectId={own.id} areaName={area.name} />}
          <TaskList tasks={open} showPlace={false} empty={`No open ${area.name} tasks.`} />
        </section>

        <section>
          <h2 className="section-title mx-4">
            Projects <span className="text-sm font-semibold text-fg-2">{active.length}</span>
          </h2>
          <ul className="divide-y divide-line">
            {active.map((p) => (
              <ProjectRow key={p.id} project={p} progress={progress?.get(p.id)} />
            ))}
          </ul>
          {active.length === 0 && <p className="px-4 py-4 text-base text-muted">No active projects.</p>}
          <AddProject area={area} />
        </section>

        {finished.length > 0 && <FinishedProjects projects={finished} progress={progress} />}
      </div>
    </div>
  );
}

function AddAreaTask({ projectId, areaName }: { projectId: string; areaName: string }) {
  const [title, setTitle] = useState('');
  return (
    <form
      className="mx-4 mt-3 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = title.trim();
        if (v) void createTask({ title: v, project_id: projectId, atTop: true });
        setTitle('');
      }}
    >
      <input className="input" placeholder={`Add a ${areaName} task`} value={title} onChange={(e) => setTitle(e.target.value)} enterKeyHint="done" />
      <button className="btn-outline shrink-0 px-3" disabled={!title.trim()} aria-label="Add task">
        <PlusIcon />
      </button>
    </form>
  );
}

function ProjectRow({ project, progress }: { project: Project; progress?: [number, number] }) {
  const [done, total] = progress ?? [0, 0];
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <li>
      <Link to={`/projects/${project.id}`} className="flex min-h-20 flex-col justify-center gap-2 px-4 py-3 hover:bg-surface-2">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1 truncate text-lg font-bold">{project.name}</span>
          <span className="text-sm font-semibold text-fg-2">
            {done} of {total} done
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: project.color ?? 'var(--accent)' }} />
        </div>
      </Link>
    </li>
  );
}

function AddProject({ area }: { area: Area }) {
  const [name, setName] = useState('');
  const navigate = useNavigate();
  return (
    <form
      className="mx-4 mt-3 flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = name.trim();
        if (!v) return;
        const p = await createProject({ name: v, area_id: area.id });
        setName('');
        navigate(`/projects/${p.id}`);
      }}
    >
      <input className="input" placeholder={`New project in ${area.name}`} value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn-primary shrink-0" disabled={!name.trim()}>Add project</button>
    </form>
  );
}

function FinishedProjects({ projects, progress }: { projects: Project[]; progress?: Map<string, [number, number]> }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button className="btn-ghost mx-2" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide' : 'Show'} completed &amp; archived projects ({projects.length})
      </button>
      {open && (
        <ul className="divide-y divide-line">
          {projects.map((p) => {
            const [done, total] = progress?.get(p.id) ?? [0, 0];
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Link to={`/projects/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold">{p.name}</div>
                  <div className="text-sm text-fg-2">
                    {p.completed_at ? `Completed ${new Date(p.completed_at).toLocaleDateString()}` : 'Archived'} · {done} of {total} done
                  </div>
                </Link>
                <button className="btn-outline shrink-0" onClick={() => void reopenProject(p.id)}>
                  Reopen
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AreaEditor({ area, first, last }: { area: Area; first: boolean; last: boolean }) {
  const navigate = useNavigate();
  const [blocker, setBlocker] = useState<string | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (confirm) void areaDeleteBlocker(area.id).then(setBlocker);
  }, [confirm, area.id]);

  return (
    <section className="card mx-4 flex flex-col gap-4 p-4">
      <div>
        <label className="field-label" htmlFor="area-name">Name</label>
        <input
          id="area-name"
          key={area.name}
          className="input"
          defaultValue={area.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== area.name) void updateArea(area.id, { name: v });
          }}
        />
      </div>
      <div>
        <span className="field-label">Color (shared by its projects)</span>
        <ColorPicker value={area.color} onChange={(color) => void updateArea(area.id, { color })} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-outline" disabled={first} onClick={() => void moveArea(area.id, -1)}><UpIcon /> Up</button>
        <button className="btn-outline" disabled={last} onClick={() => void moveArea(area.id, 1)}><DownIcon /> Down</button>
        <div className="flex-1" />
        {!confirm && <button className="btn-danger" onClick={() => setConfirm(true)}>Delete area</button>}
      </div>
      {confirm && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {blocker === undefined ? null : blocker ? (
            <p className="flex-1 text-base font-semibold text-warn">Can’t delete yet: {blocker}</p>
          ) : (
            <p className="flex-1 text-base text-fg-2">Delete {area.name}? Its finished tasks and archived projects go with it.</p>
          )}
          <button className="btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
          {blocker === null && (
            <button className="btn-danger border-2 border-danger" onClick={() => void deleteArea(area.id).then(() => navigate('/areas'))}>
              Delete
            </button>
          )}
        </div>
      )}
    </section>
  );
}
