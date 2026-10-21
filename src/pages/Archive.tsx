import { useState } from 'react';
import { restoreTask } from '../db/actions';
import { useAllTasks, useAreas, useProjects } from '../db/hooks';
import type { Task } from '../db/types';
import { isArchived } from '../lib/tasks';
import { isRealProject, placeOf } from '../lib/paths';
import { PageHeader } from '../components/PageHeader';
import { useOpenTask } from '../components/useOpenTask';

const archivedAt = (t: Task) => t.cancelled_at ?? t.archived_at ?? t.completed_at ?? t.updated_at;

export function Archive() {
  const tasks = useAllTasks();
  const areas = useAreas() ?? [];
  const projects = useProjects() ?? [];
  const openTask = useOpenTask();
  const [areaId, setAreaId] = useState('');
  const [projectId, setProjectId] = useState('');

  if (!tasks) return null;

  const projectById = new Map(projects.map((p) => [p.id, p]));
  const areaMap = new Map(areas.map((a) => [a.id, a]));
  const list = tasks
    .filter((t) => isArchived(t))
    .filter((t) => !areaId || projectById.get(t.project_id)?.area_id === areaId)
    .filter((t) => !projectId || t.project_id === projectId)
    .sort((a, b) => (archivedAt(a) < archivedAt(b) ? 1 : -1));

  return (
    <div>
      <PageHeader title="Archive" />
      <div className="grid grid-cols-1 gap-2 p-4 min-[360px]:grid-cols-2">
        <select className="input" value={areaId} onChange={(e) => { setAreaId(e.target.value); setProjectId(''); }} aria-label="Realm">
          <option value="">All realms</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} aria-label="Project">
          <option value="">All projects</option>
          {projects
            .filter((p) => isRealProject(p) && (!areaId || p.area_id === areaId))
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </div>
      <p className="px-4 text-sm text-fg-2">
        Completed tasks move here 7 days after completion; cancelled tasks move here right away. Both are kept
        indefinitely.
      </p>
      {list.length === 0 ? (
        <p className="px-4 py-4 text-base text-muted">Nothing archived yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-4">
              <button className="min-w-0 flex-1 text-left" onClick={() => openTask(t.id)}>
                <div className={`text-base font-semibold break-words ${t.completed_at ? 'text-fg-2 line-through' : t.cancelled_at ? 'text-fg-2' : 'text-fg'}`}>{t.title}</div>
                <div className="mt-1 text-sm text-fg-2">
                  {t.cancelled_at && <span className="chip mr-2 text-warn">Cancelled</span>}
                  {placeOf(projectById.get(t.project_id), areaMap)?.label} · {new Date(archivedAt(t)).toLocaleDateString()}
                </div>
              </button>
              <button className="btn-outline shrink-0" onClick={() => void restoreTask(t)}>Restore</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
