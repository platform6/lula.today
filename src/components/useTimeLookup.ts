import { useMemo } from 'react';
import { useAreas, useProjects, useTimeTags, useTimeTasks } from '../db/hooks';
import type { Project, TimeEntry } from '../db/types';
import { placeOf, tracksTime } from '../lib/paths';
import { byPosition } from '../lib/position';

/** Names and colors for time entries, and the projects that can take time. */
export function useTimeLookup() {
  const areas = useAreas();
  const projects = useProjects();
  const tasks = useTimeTasks();
  const tags = useTimeTags();

  return useMemo(() => {
    const areaMap = new Map((areas ?? []).map((a) => [a.id, a]));
    const projectMap = new Map((projects ?? []).map((p) => [p.id, p]));
    const taskMap = new Map((tasks ?? []).map((t) => [t.id, t]));
    const tagMap = new Map((tags ?? []).map((t) => [t.id, t]));
    const place = (projectId: string | null) => placeOf(projectId ? projectMap.get(projectId) : undefined, areaMap);

    // Realm order, each realm's own list before its projects; projects without a realm last.
    const realmIndex = new Map((areas ?? []).map((a, i) => [a.id, i]));
    const rank = (p: Project) => realmIndex.get(p.area_id ?? '') ?? Infinity;
    const timeProjects = (projects ?? [])
      .filter((p) => tracksTime(p) && !p.archived_at)
      .sort((a, b) => rank(a) - rank(b) || Number(b.is_area_default) - Number(a.is_area_default) || byPosition(a, b));

    return {
      loaded: !!areas && !!projects && !!tasks && !!tags,
      areas: areaMap,
      projects: projectMap,
      tasks: taskMap,
      tags: tagMap,
      timeProjects,
      tasksOf: (projectId: string | null) => (tasks ?? []).filter((t) => t.project_id === projectId && !t.archived_at),
      projectLabel: (projectId: string | null) => place(projectId)?.label ?? 'No project',
      projectColor: (projectId: string | null) => place(projectId)?.color ?? null,
      /** The realm time on the project counts toward; none for Sorting or no project. */
      realmOf: (projectId: string | null) => place(projectId)?.area?.id ?? null,
      /** What the entry was spent on: its task, else its project. */
      entryTitle: (e: TimeEntry) =>
        (e.time_task_id && taskMap.get(e.time_task_id)?.name) || place(e.project_id)?.label || 'No project',
    };
  }, [areas, projects, tasks, tags]);
}

export type TimeLookup = ReturnType<typeof useTimeLookup>;
