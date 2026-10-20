import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addColumn,
  archiveProject,
  deleteColumn,
  deleteProject,
  moveColumn,
  renameColumn,
  setColumnDone,
  updateProject,
} from '../db/actions';
import { useAreas, useColumns, useProject, useProjectTasks } from '../db/hooks';
import { isLive } from '../lib/tasks';
import { ColorPicker } from '../components/ColorPicker';
import { ColumnsEditor } from '../components/ColumnsEditor';
import { PageHeader } from '../components/PageHeader';
import { BackIcon } from '../components/icons';

export function ProjectSettings() {
  const { id } = useParams();
  const project = useProject(id);
  const columns = useColumns(id) ?? [];
  const tasks = useProjectTasks(id) ?? [];
  const areas = useAreas() ?? [];
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (project === undefined) return null;
  if (project === null) return <p className="p-4 text-muted">Project not found.</p>;

  // Archived tasks still sit in a column, so count every non-deleted task.
  const counts = new Map<string, number>();
  for (const t of tasks) counts.set(t.column_id, (counts.get(t.column_id) ?? 0) + 1);
  const liveCount = tasks.filter((t) => isLive(t)).length;

  return (
    <div>
      <PageHeader
        title={`${project.is_inbox ? 'Inbox' : project.name} settings`}
        back={
          <Link to={project.is_inbox ? '/inbox' : `/projects/${project.id}`} className="btn-ghost -ml-2 px-2" aria-label="Back">
            <BackIcon />
          </Link>
        }
      />
      <div className="mx-auto flex max-w-xl flex-col gap-6 p-4">
        {!project.is_inbox && (
          <section className="flex flex-col gap-3">
            <div>
              <label className="field-label">Name</label>
              <input
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
              <label className="field-label">Area</label>
              <select
                className="input"
                value={project.area_id ?? ''}
                onChange={(e) => void updateProject(project.id, { area_id: e.target.value || null })}
              >
                <option value="">No area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Color</label>
              <ColorPicker value={project.color} onChange={(color) => void updateProject(project.id, { color })} />
            </div>
            <div>
              <label className="field-label">Description</label>
              <textarea
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
        )}

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

        {!project.is_inbox && (
          <section className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button className="btn-outline" onClick={() => void archiveProject(project.id, !project.archived_at)}>
              {project.archived_at ? 'Unarchive project' : 'Archive project'}
            </button>
            <div className="flex-1" />
            {confirmDelete ? (
              <>
                <span className="text-base text-fg-2">Delete project and {liveCount} active task{liveCount === 1 ? '' : 's'}?</span>
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
                <button
                  className="btn-danger"
                  onClick={() => void deleteProject(project.id).then(() => navigate('/projects'))}
                >
                  Delete
                </button>
              </>
            ) : (
              <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete project</button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
