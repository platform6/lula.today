import type { Area, Project } from '../db/types';

/**
 * Where a task lives, as people should read it:
 *   Inbox · Home (area tasks) · Home › Kitchen reno (project)
 */
export interface Place {
  kind: 'inbox' | 'area' | 'project';
  area?: Area;
  project?: Project;
  label: string;
  color: string | null;
  /** Route for the place's main view. */
  href: string;
}

export function placeOf(project: Project | undefined, areas: Map<string, Area>): Place | undefined {
  if (!project) return undefined;
  if (project.is_inbox) return { kind: 'inbox', project, label: 'Sorting', color: null, href: '/inbox' };
  const area = project.area_id ? areas.get(project.area_id) : undefined;
  if (project.is_area_default) {
    return {
      kind: 'area',
      area,
      project,
      label: area?.name ?? project.name,
      color: area?.color ?? project.color,
      href: area ? `/realms/${area.id}` : `/projects/${project.id}`,
    };
  }
  return {
    kind: 'project',
    area,
    project,
    label: area ? `${area.name} › ${project.name}` : project.name,
    color: project.color ?? area?.color ?? null,
    href: `/projects/${project.id}`,
  };
}

/** Projects that people see as projects (not the Inbox or an area's own list). */
export const isRealProject = (p: Project) => !p.is_inbox && !p.is_area_default && !p.deleted_at;

/** A project shows its kanban board unless it was switched to time tracking only. */
export const showsBoard = (p: Project) => p.show_board !== false;

/** The project can be picked for time tracking and shows a time report. */
export const tracksTime = (p: Project) => p.track_time === true && !p.is_inbox;
