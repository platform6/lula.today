// Maps the portfolio's old time_entries (Clockify exports and the quick app) onto
// lula: each Clockify project lands on a lula project (or a realm's own list),
// duplicate names merge, and wall-clock times are read as US Eastern. Used by
// scripts/import-time.ts.

import { stableUuid } from './ids';
import { nameKey, zonedToUtc } from './time';

export const OLD_ZONE = 'America/New_York';

/**
 * Clockify project -> where its time goes in lula: a realm, and optionally a project in it
 * (used when it exists; otherwise the realm's own list, with the project name as the task).
 * `task` puts every entry on one task and moves the entry's own task to its description.
 * Anything not listed, or whose realm doesn't exist yet, stays unsorted (no project).
 */
export const PROJECT_TARGET: Record<string, { realm: string; project?: string; task?: string }> = {
  'Art/Drawing': { realm: 'Art' },
  Coding: { realm: 'Dev' },
  Freelance: { realm: 'Work', project: 'Freelance' },
  'Game Dev': { realm: 'GameDev' },
  Music: { realm: 'Music' },
  'Music/noise': { realm: 'Music', task: 'Noise' },
  'Playing Video Games': { realm: 'Video Games' },
  'Video Games': { realm: 'Video Games' },
  Reading: { realm: 'Reading' },
  Swimming: { realm: 'Move', project: 'Swimming' },
  Walking: { realm: 'Move', project: 'Walking' },
  Writing: { realm: 'Writing' },
};

/**
 * Task names to merge or correct, by matching key (see nameKey). Names that differ
 * only in case or spacing merge on their own, keeping the most used spelling.
 */
export const TASK_RENAMES: Record<string, string> = {
  ballatro: 'Balatro',
  ballxpitt: 'Ball X Pit',
  'clair obsucra: expedition 33': 'Clair Obscur: Expedition 33',
  'elden ring: nightriegn': 'Elden Ring: Nightreign',
  'game art': 'Game Art',
  'on a winters night four travlera': "On a Winter's Night, Four Travelers",
  'research/turorials': 'Research/Tutorials',
  'research/tutorials': 'Research/Tutorials',
};

export interface OldEntry {
  id: string;
  project: string | null;
  task: string | null;
  description: string | null;
  tags: string[] | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  duration_seconds: number;
  metadata: { quick_app?: { start?: string; end?: string } } | null;
}

export interface Realm {
  id: string;
  name: string;
}

export interface LulaProject {
  id: string;
  area_id: string | null;
  name: string;
  is_area_default: boolean;
}

export interface ImportPlan {
  tasks: { id: string; project_id: string | null; name: string }[];
  tags: { id: string; name: string }[];
  entries: {
    id: string;
    started_at: string;
    ended_at: string;
    project_id: string | null;
    time_task_id: string | null;
    tag_ids: string[];
    description: string | null;
    source: string;
  }[];
  /** Old project -> where it lands, e.g. "Move › Swimming" or "Dev" (null: unsorted), with entry counts. */
  projects: { project: string; target: string | null; entries: number }[];
  /** lula projects that receive time, so they get time tracking turned on. */
  timeProjects: string[];
  /** Task names that were renamed or merged, per target. */
  merges: { target: string | null; from: string[]; to: string }[];
  /** Entries whose start-to-end time differs from the recorded duration by more than a second. */
  durationMismatches: string[];
}

const clean = (s: string | null | undefined) => s?.trim().replace(/\s+/g, ' ') || null;

/** Most used spelling of each name key. */
function spellings(names: string[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const n of names) {
    const byKey = counts.get(nameKey(n)) ?? new Map<string, number>();
    byKey.set(n, (byKey.get(n) ?? 0) + 1);
    counts.set(nameKey(n), byKey);
  }
  const best = new Map<string, string>();
  for (const [key, byName] of counts) best.set(key, [...byName].sort((a, b) => b[1] - a[1])[0][0]);
  return best;
}

type Target = { project: LulaProject; label: string; task?: string };

export async function planImport(
  userId: string,
  rows: OldEntry[],
  realms: Realm[],
  projects: LulaProject[],
): Promise<ImportPlan> {
  const realmByName = new Map(realms.map((r) => [nameKey(r.name), r]));
  const targetFor = (oldProject: string | null): Target | null => {
    const map = oldProject ? PROJECT_TARGET[oldProject] : undefined;
    const realm = map && realmByName.get(nameKey(map.realm));
    if (!map || !realm) return null;
    const named = map.project
      ? projects.find((p) => !p.is_area_default && p.area_id === realm.id && nameKey(p.name) === nameKey(map.project!))
      : undefined;
    if (named) return { project: named, label: `${realm.name} › ${named.name}`, task: map.task };
    const own = projects.find((p) => p.is_area_default && p.area_id === realm.id);
    if (!own) return null;
    // No such project yet: its name becomes the task on the realm's own list.
    return { project: own, label: realm.name, task: map.task ?? map.project };
  };

  // Work out each entry's task name before merging spellings.
  const shaped = rows.map((r) => {
    const project = clean(r.project);
    const ownTask = clean(r.task);
    const target = targetFor(project);
    const task = target?.task ?? ownTask;
    const moved = target?.task && ownTask ? ownTask : null;
    const description = [moved, clean(r.description)].filter(Boolean).join(' - ') || null;
    return { r, project, target, task, description };
  });

  const renamed = (name: string) => TASK_RENAMES[nameKey(name)] ?? name;
  const best = spellings(shaped.flatMap((s) => (s.task ? [renamed(s.task)] : [])));
  const finalName = (name: string) => best.get(nameKey(renamed(name)))!;

  const tasks = new Map<string, ImportPlan['tasks'][number]>();
  const mergeSources = new Map<string, { target: string | null; to: string; from: Set<string> }>();
  const taskFor = async (target: Target | null, raw: string) => {
    const name = finalName(raw);
    const projectId = target?.project.id ?? null;
    const key = `${projectId ?? 'unsorted'}|${nameKey(name)}`;
    if (raw !== name) {
      const m = mergeSources.get(key) ?? { target: target?.label ?? null, to: name, from: new Set<string>() };
      m.from.add(raw);
      mergeSources.set(key, m);
    }
    let task = tasks.get(key);
    if (!task) {
      task = { id: await stableUuid(`${userId}:time_task:${key}`), project_id: projectId, name };
      tasks.set(key, task);
    }
    return task;
  };

  const tagSpelling = spellings(rows.flatMap((r) => (r.tags ?? []).map((t) => clean(t)!).filter(Boolean)));
  const tags = new Map<string, ImportPlan['tags'][number]>();
  const tagFor = async (raw: string) => {
    const key = nameKey(raw);
    let tag = tags.get(key);
    if (!tag) {
      tag = { id: await stableUuid(`${userId}:time_tag:${key}`), name: tagSpelling.get(key)! };
      tags.set(key, tag);
    }
    return tag;
  };

  const entries: ImportPlan['entries'] = [];
  const durationMismatches: string[] = [];
  const projectCounts = new Map<string, { target: string | null; entries: number }>();
  const timeProjects = new Set<string>();
  for (const s of shaped) {
    const { r } = s;
    const quick = r.metadata?.quick_app;
    const started_at = quick?.start ? new Date(quick.start).toISOString() : zonedToUtc(r.start_date, r.start_time, OLD_ZONE);
    const ended_at = quick?.end ? new Date(quick.end).toISOString() : zonedToUtc(r.end_date, r.end_time, OLD_ZONE);
    const seconds = (Date.parse(ended_at) - Date.parse(started_at)) / 1000;
    if (!quick && Math.abs(seconds - r.duration_seconds) > 1) durationMismatches.push(r.id);

    const task = s.task ? await taskFor(s.target, s.task) : null;
    const tagIds: string[] = [];
    for (const t of r.tags ?? []) {
      const name = clean(t);
      if (name) tagIds.push((await tagFor(name)).id);
    }
    if (s.target) timeProjects.add(s.target.project.id);
    entries.push({
      id: r.id,
      started_at,
      ended_at,
      project_id: s.target?.project.id ?? null,
      time_task_id: task?.id ?? null,
      tag_ids: [...new Set(tagIds)],
      description: s.description,
      source: 'import',
    });

    const label = s.project ?? '(no project)';
    const count = projectCounts.get(label) ?? { target: s.target?.label ?? null, entries: 0 };
    count.entries++;
    projectCounts.set(label, count);
  }

  return {
    tasks: [...tasks.values()],
    tags: [...tags.values()],
    entries,
    projects: [...projectCounts].map(([project, c]) => ({ project, ...c })).sort((a, b) => b.entries - a.entries),
    timeProjects: [...timeProjects],
    merges: [...mergeSources.values()].map((m) => ({ target: m.target, from: [...m.from].sort(), to: m.to })),
    durationMismatches,
  };
}
