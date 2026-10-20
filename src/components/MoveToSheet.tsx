import { useState } from 'react';
import { moveTaskToProject } from '../db/actions';
import { useAreas, useProjects } from '../db/hooks';
import type { Area } from '../db/types';
import { byPosition } from '../lib/position';
import { BackIcon } from './icons';
import { TreeNode } from './NodeTree';
import { Sheet } from './Sheet';

/** Two-step sort: choose a realm, then the realm itself or one of its projects. */
export function MoveToSheet({ taskId, title, onClose }: { taskId: string; title: string; onClose: () => void }) {
  return (
    <Sheet title={<span className="block truncate">Move “{title}”</span>} onClose={onClose} side="center">
      <MoveToPicker taskId={taskId} onMoved={onClose} />
    </Sheet>
  );
}

export function MoveToPicker({ taskId, onMoved }: { taskId: string; onMoved: () => void }) {
  const areas = useAreas() ?? [];
  const projects = (useProjects() ?? []).filter((p) => !p.archived_at);
  const [area, setArea] = useState<Area | null>(null);

  const move = async (projectId: string) => {
    await moveTaskToProject(taskId, projectId);
    onMoved();
  };

  if (areas.length === 0) {
    return <p className="p-4 text-base text-fg-2">Create a realm first (Realms tab), then sort tasks into it.</p>;
  }

  if (!area) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="field-label">Which realm?</p>
        <div className="grid grid-cols-2 gap-2">
          {areas.map((a) => (
            <button
              key={a.id}
              className="card flex min-h-16 items-center gap-3 border-2 border-l-8 px-4 text-left text-lg font-bold hover:bg-surface-2"
              style={{ borderLeftColor: a.color ?? 'var(--line-strong)' }}
              onClick={() => setArea(a)}
            >
              <span className="min-w-0 truncate">{a.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const own = projects.find((p) => p.is_area_default && p.area_id === area.id);
  const list = projects.filter((p) => p.area_id === area.id && !p.is_area_default).sort(byPosition);

  return (
    <div className="flex flex-col gap-2 p-4">
      <button className="btn-ghost -ml-2 self-start" onClick={() => setArea(null)}>
        <BackIcon /> All realms
      </button>
      {own && (
        <button
          className="flex min-h-16 items-center gap-3 rounded-md border-2 border-accent bg-accent/15 px-4 text-left text-lg font-bold hover:bg-accent/25"
          onClick={() => void move(own.id)}
        >
          <span className="h-4 w-4 shrink-0 rounded-sm" style={{ background: area.color ?? 'var(--line-strong)' }} />
          <span className="min-w-0 flex-1">
            {area.name}
            <span className="block text-sm font-medium text-fg-2">Realm task, no project</span>
          </span>
        </button>
      )}
      {list.length > 0 && <p className="field-label mt-2">Or a project in {area.name}</p>}
      {list.map((p) => (
        <button
          key={p.id}
          className="card flex min-h-14 items-center gap-3 border-2 px-4 text-left text-base font-semibold hover:bg-surface-2"
          onClick={() => void move(p.id)}
        >
          <TreeNode kind="project" color={area.color} />
          <span className="min-w-0 flex-1 truncate">{p.name}</span>
        </button>
      ))}
    </div>
  );
}
