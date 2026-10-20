import { useState } from 'react';
import { restoreTask } from '../db/actions';
import { useAllTasks, useAreas, useProjects } from '../db/hooks';
import type { Task } from '../db/types';
import { isArchived } from '../lib/tasks';
import { PageHeader } from '../components/PageHeader';
import { useOpenTask } from '../components/useOpenTask';

const archivedAt = (t: Task) => t.archived_at ?? t.completed_at ?? t.updated_at;

export function Archive() {
  const tasks = useAllTasks();
  const areas = useAreas() ?? [];
  const projects = useProjects() ?? [];
  const openTask = useOpenTask();
  const [areaId, setAreaId] = useState('');
  const [projectId, setProjectId] = useState('');

  if (!tasks) return null;

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const list = tasks
    .filter((t) => isArchived(t))
    .filter((t) => !areaId || projectById.get(t.project_id)?.area_id === areaId)
    .filter((t) => !projectId || t.project_id === projectId)
    .sort((a, b) => (archivedAt(a) < archivedAt(b) ? 1 : -1));

  return (
    <div>
      <PageHeader title="Archive" />
      <div className="grid grid-cols-2 gap-2 p-4">
        <select className="input" value={areaId} onChange={(e) => { setAreaId(e.target.value); setProjectId(''); }} aria-label="Area">
          <option value="">All areas</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {projects
            .filter((p) => !areaId || p.area_id === areaId)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </div>
      <p className="px-4 text-xs text-muted">
        Completed tasks move here 7 days after completion and are kept indefinitely.
      </p>
      {list.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">Nothing archived yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)}>
                <div className={`break-words ${t.completed_at ? 'text-muted line-through' : ''}`}>{t.title}</div>
                <div className="mt-0.5 text-xs text-muted">
                  {projectById.get(t.project_id)?.name} · {new Date(archivedAt(t)).toLocaleDateString()}
                </div>
              </button>
              <button className="btn-ghost shrink-0" onClick={() => void restoreTask(t)}>Restore</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
