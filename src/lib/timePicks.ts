import type { TimeEntry, TimeField } from '../db/types';

// What the time pickers put first: values, tags and projects you use, worked out
// from your entries (newest first, as useTimeEntries gives them).

/** Values typed in a field before, most recently used first, without repeats (ignoring case). */
export function fieldSuggestions(entries: TimeEntry[], fieldId: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of entries) {
    const v = e.fields?.[fieldId]?.trim();
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
  }
  return out;
}

/** Tag ids used on entries in a realm, most used first (ties: most recently used first). */
export function realmTagIds(entries: TimeEntry[], realmId: string, realmOf: (projectId: string | null) => string | null): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    if (realmOf(e.project_id) !== realmId) continue;
    for (const id of e.tag_ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  // Map keeps first-seen order, which is most recent first; the sort is stable.
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** Projects of the latest entries, newest first, without repeats. */
export function recentProjectIds(entries: TimeEntry[], limit: number): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (!e.project_id || out.includes(e.project_id)) continue;
    out.push(e.project_id);
    if (out.length === limit) break;
  }
  return out;
}

/** Whether a field shows for a project in this realm: everywhere when it has no realm, else only there. */
export const fieldApplies = (f: TimeField, realmId: string | null) => !f.archived_at && (!f.area_id || f.area_id === realmId);
