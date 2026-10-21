import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { currentUserId } from './mutate';
import type { Area, BoardColumn, BusPurchase, Label, Project, Settings, Step, Task, WorkDay } from './types';
import { byPosition } from '../lib/position';

// Live views over the local database. They re-render whenever the underlying
// tables change, whether from a local edit or a sync pull.

const alive = <T extends { deleted_at: string | null }>(r: T) => !r.deleted_at;

export function useAreas(): Area[] | undefined {
  return useLiveQuery(async () => (await db.areas.toArray()).filter(alive).sort(byPosition));
}

export function useProjects(): Project[] | undefined {
  return useLiveQuery(async () => (await db.projects.toArray()).filter(alive).sort(byPosition));
}

export function useProject(id: string | undefined): Project | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const p = await db.projects.get(id);
    return p && alive(p) ? p : null;
  }, [id]);
}

export function useColumns(projectId: string | undefined): BoardColumn[] | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return [];
    return (await db.board_columns.where('project_id').equals(projectId).toArray()).filter(alive).sort(byPosition);
  }, [projectId]);
}

export function useAllColumns(): Map<string, BoardColumn> | undefined {
  return useLiveQuery(async () => new Map((await db.board_columns.toArray()).map((c) => [c.id, c])));
}

/** All non-deleted tasks (including archived); callers filter further. */
export function useAllTasks(): Task[] | undefined {
  return useLiveQuery(async () => (await db.tasks.toArray()).filter(alive));
}

export function useProjectTasks(projectId: string | undefined): Task[] | undefined {
  return useLiveQuery(async () => {
    if (!projectId) return [];
    return (await db.tasks.where('project_id').equals(projectId).toArray()).filter(alive).sort(byPosition);
  }, [projectId]);
}

export function useTask(id: string | null): Task | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const t = await db.tasks.get(id);
    return t && alive(t) ? t : null;
  }, [id]);
}

export function useSteps(taskId: string | null): Step[] | undefined {
  return useLiveQuery(async () => {
    if (!taskId) return [];
    return (await db.steps.where('task_id').equals(taskId).toArray()).filter(alive).sort(byPosition);
  }, [taskId]);
}

/** Step progress per task id: [done, total]. */
export function useStepCounts(): Map<string, [number, number]> | undefined {
  return useLiveQuery(async () => {
    const counts = new Map<string, [number, number]>();
    for (const s of await db.steps.toArray()) {
      if (s.deleted_at) continue;
      const c = counts.get(s.task_id) ?? [0, 0];
      c[1]++;
      if (s.is_done) c[0]++;
      counts.set(s.task_id, c);
    }
    return counts;
  });
}

export function useLabels(): Label[] | undefined {
  return useLiveQuery(async () =>
    (await db.labels.toArray()).filter(alive).sort((a, b) => a.name.localeCompare(b.name)),
  );
}

/** Active label ids per task id. */
export function useTaskLabelMap(): Map<string, string[]> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, string[]>();
    for (const l of await db.task_labels.toArray()) {
      if (l.deleted_at) continue;
      map.set(l.task_id, [...(map.get(l.task_id) ?? []), l.label_id]);
    }
    return map;
  });
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => db.settings.get(currentUserId()));
}

export function useAreaMap(): Map<string, Area> {
  const areas = useAreas();
  return useMemo(() => new Map((areas ?? []).map((a) => [a.id, a])), [areas]);
}

/** Open tasks waiting in the Inbox to be sorted. */
export function useInboxCount(): number {
  return (
    useLiveQuery(async () => {
      const inbox = (await db.projects.toArray()).find((p) => p.is_inbox && !p.deleted_at);
      if (!inbox) return 0;
      return (await db.tasks.where('project_id').equals(inbox.id).toArray()).filter(
        (t) => !t.deleted_at && !t.archived_at && !t.completed_at,
      ).length;
    }) ?? 0
  );
}

/** [done, total] per project, counting archived tasks so finished work stays counted. */
export function useProjectProgress(): Map<string, [number, number]> | undefined {
  return useLiveQuery(async () => {
    const map = new Map<string, [number, number]>();
    for (const t of await db.tasks.toArray()) {
      if (t.deleted_at) continue;
      const c = map.get(t.project_id) ?? [0, 0];
      c[1]++;
      if (t.completed_at) c[0]++;
      map.set(t.project_id, c);
    }
    return map;
  });
}

export function usePendingCount(): number {
  return useLiveQuery(() => db.outbox.count()) ?? 0;
}

/** Every work log day, oldest first. */
export function useWorkDays(): WorkDay[] | undefined {
  return useLiveQuery(async () => (await db.work_days.orderBy('day').toArray()).filter(alive));
}

export function useBusPurchases(): BusPurchase[] | undefined {
  return useLiveQuery(async () => (await db.bus_purchases.toArray()).filter(alive));
}
