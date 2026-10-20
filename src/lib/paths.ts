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
  if (project.is_inbox) return { kind: 'inbox', project, label: 'Inbox', color: null, href: '/inbox' };
  const area = project.area_id ? areas.get(project.area_id) : undefined;
  if (project.is_area_default) {
    return {
      kind: 'area',
      area,
      project,
      label: area?.name ?? project.name,
      color: area?.color ?? project.color,
      href: area ? `/areas/${area.id}` : `/projects/${project.id}`,
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
