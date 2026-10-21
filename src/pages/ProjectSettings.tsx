import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addColumn,
  archiveProject,
  completeProject,
  deleteColumn,
  deleteProject,
  moveColumn,
  openTasksOf,
  renameColumn,
  reopenProject,
  setColumnDone,
  setProjectArea,
  updateProject,
} from '../db/actions';
import { useAreas, useColumns, useProject, useProjectTasks } from '../db/hooks';
import type { Area, Project } from '../db/types';
import { isLive } from '../lib/tasks';
import { ColumnsEditor } from '../components/ColumnsEditor';
import { PageHeader } from '../components/PageHeader';
import { BackIcon } from '../components/icons';

export function ProjectSettings() {
  const { id } = useParams();
  const project = useProject(id);
  const columns = useColumns(id) ?? [];
  const tasks = useProjectTasks(id) ?? [];
  const areas = useAreas() ?? [];

  if (project === undefined) return null;
  if (project === null) return <p className="p-4 text-base text-muted">Project not found.</p>;

  const area = areas.find((a) => a.id === project.area_id);
  const builtIn = project.is_inbox || project.is_area_default;
  const title = project.is_inbox ? 'Sorting' : project.is_area_default ? `${area?.name ?? project.name} tasks` : project.name;

  // Archived tasks still sit in a column, so count every non-deleted task.
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.column_id, (counts.get(t.column_id) ?? 0) + 1);

  return (
    <div>
      <PageHeader
        title={`${title} settings`}
        back={
          <Link to={`/projects/${project.id}`} className="btn-ghost -ml-2 px-2" aria-label="Back to board">
            <BackIcon />
          </Link>
        }
      />
      <div className="mx-auto flex max-w-xl flex-col gap-8 p-4">
        {!builtIn && <Details project={project} areas={areas} />}

        <section>
          <h2 className="section-title">Board columns</h2>
          <p className="mt-2 mb-3 text-sm text-fg-2">
            Tasks moved into a column marked <b>Done</b> count as completed and are archived 7 days later.
          </p>
          <ColumnsEditor
            columns={columns.map((c) => ({ key: c.id, name: c.name, is_done: c.is_done, taskCount: counts.get(c.id) ?? 0 }))}
            onRename={(key, name) => void renameColumn(key, name)}
            onToggleDone={(key, done) => void setColumnDone(key, done)}
            onMove={(key, dir) => void moveColumn(project.id, key, dir)}
            onDelete={(key, moveTo) => void deleteColumn(key, moveTo)}
            onAdd={(name) => void addColumn(project.id, name)}
          />
        </section>

        {!builtIn && <Lifecycle project={project} area={area} liveCount={tasks.filter((t) => isLive(t)).length} />}
      </div>
    </div>
  );
}

function Details({ project, areas }: { project: Project; areas: Area[] }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <label className="field-label" htmlFor="project-name">Name</label>
        <input
          id="project-name"
          key={project.name}
          className="input"
          defaultValue={project.name}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== project.name) void updateProject(project.id, { name: v });
          }}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="project-area">Realm</label>
        <select
          id="project-area"
          className="input"
          value={areas.some((a) => a.id === project.area_id) ? (project.area_id ?? '') : ''}
          onChange={(e) => e.target.value && void setProjectArea(project.id, e.target.value)}
        >
          <option value="" disabled>
            Choose a realm…
          </option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <p className="mt-1.5 text-sm text-fg-2">The project takes its color from its realm.</p>
      </div>
      <div>
        <label className="field-label" htmlFor="project-desc">Description</label>
        <textarea
          id="project-desc"
          className="input"
          rows={2}
          defaultValue={project.description ?? ''}
          onBlur={(e) => {
            const v = e.target.value.trim() || null;
            if (v !== project.description) void updateProject(project.id, { description: v });
          }}
        />
      </div>
    </section>
  );
}

function Lifecycle({ project, area, liveCount }: { project: Project; area: Area | undefined; liveCount: number }) {
  const navigate = useNavigate();
  const [completing, setCompleting] = useState(false);
  const [openCount, setOpenCount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const back = area ? `/realms/${area.id}` : '/realms';

  useEffect(() => {
    if (completing) void openTasksOf(project.id).then((t) => setOpenCount(t.length));
  }, [completing, project.id]);

  const finish = async (openTasks: 'move' | 'archive') => {
    await completeProject(project.id, openTasks);
    navigate(back);
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">Finish</h2>
      {project.completed_at ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="flex-1 text-base text-fg-2">
            Completed {new Date(project.completed_at).toLocaleDateString()}.
          </p>
          <button className="btn-outline" onClick={() => void reopenProject(project.id)}>Reopen project</button>
        </div>
      ) : completing ? (
        <div className="card flex flex-col gap-3 p-4">
          {openCount > 0 ? (
            <>
              <p className="text-base">
                <b>{openCount}</b> task{openCount === 1 ? ' is' : 's are'} still open. What should happen to {openCount === 1 ? 'it' : 'them'}?
              </p>
              <button className="btn-primary" onClick={() => void finish('move')}>
                Move to {area?.name ?? 'realm'} tasks and complete
              </button>
              <button className="btn-outline" onClick={() => void finish('archive')}>Archive them too and complete</button>
            </>
          ) : (
            <>
              <p className="text-base">Every task is done. Mark {project.name} complete?</p>
              <button className="btn-primary" onClick={() => void finish('move')}>Complete project</button>
            </>
          )}
          <button className="btn-ghost" onClick={() => setCompleting(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-primary self-start" onClick={() => setCompleting(true)}>Complete project</button>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {!project.completed_at && (
          <button className="btn-outline" onClick={() => void archiveProject(project.id, !project.archived_at)}>
            {project.archived_at ? 'Unarchive project' : 'Archive without completing'}
          </button>
        )}
        <div className="flex-1" />
        {confirmDelete ? (
          <>
            <span className="text-base text-fg-2">
              Delete project and {liveCount} active task{liveCount === 1 ? '' : 's'}?
            </span>
            <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="btn-danger border-2 border-danger" onClick={() => void deleteProject(project.id).then(() => navigate(back))}>
              Delete
            </button>
          </>
        ) : (
          <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete project</button>
        )}
      </div>
    </section>
  );
}
