import { useMemo, useState } from 'react';
import { useTimeEntries, useTimeTasks } from '../db/hooks';
import { mergeTimeTasks, removeTimeTask, renameTimeTask, restoreTimeTask } from '../db/time';
import type { TimeTask } from '../db/types';
import { entrySeconds, formatDuration, nameKey } from '../lib/time';
import { PencilIcon, XIcon } from './icons';

/**
 * A project's activities (its own list's, for a realm). Each row renames or
 * deletes; tick two or more and Merge combines them into the one you keep.
 * Deleting hides an activity from the pickers (its entries keep it) and can be undone.
 */
export function ActivitiesEditor({ projectId, name }: { projectId: string; name: string }) {
  const all = (useTimeTasks() ?? []).filter((t) => t.project_id === projectId);
  const entries = useTimeEntries();
  const [selected, setSelected] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);
  const [keep, setKeep] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; undo?: () => void } | null>(null);

  const usage = useMemo(() => {
    const now = Date.now();
    const map = new Map<string, { count: number; seconds: number }>();
    for (const e of entries ?? []) {
      if (!e.time_task_id) continue;
      const u = map.get(e.time_task_id) ?? { count: 0, seconds: 0 };
      u.count += 1;
      u.seconds += entrySeconds(e, now);
      map.set(e.time_task_id, u);
    }
    return map;
  }, [entries]);

  const active = all.filter((t) => !t.archived_at);
  const removed = all.filter((t) => t.archived_at);
  const used = (id: string) => usage.get(id) ?? { count: 0, seconds: 0 };
  const entriesLabel = (n: number) => `${n} entr${n === 1 ? 'y' : 'ies'}`;
  // Ticks on activities that have since gone don't count.
  const picked = active.filter((t) => selected.includes(t.id));

  const toggle = (id: string) => {
    setMerging(false);
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const rename = (t: TimeTask, next: string) => {
    const twin = active.find((o) => o.id !== t.id && nameKey(o.name) === nameKey(next));
    if (twin) {
      setNotice({ text: `Another activity is already called ${twin.name}. To combine them, tick both and Merge.` });
      return;
    }
    setNotice(null);
    if (next !== t.name) void renameTimeTask(t.id, next);
  };

  const remove = (t: TimeTask) => {
    setSelected((s) => s.filter((x) => x !== t.id));
    setMerging(false);
    void removeTimeTask(t.id);
    setNotice({ text: `Deleted ${t.name}.`, undo: () => void restoreTimeTask(t.id).then(() => setNotice(null)) });
  };

  const startMerge = () => {
    // Keep the most used by default.
    const top = [...picked].sort((a, b) => used(b.id).count - used(a.id).count)[0];
    setKeep(top.id);
    setMerging(true);
  };

  const merge = async () => {
    const into = picked.find((t) => t.id === keep);
    if (!into) return;
    const from = picked.filter((t) => t.id !== keep);
    let moved = 0;
    for (const t of from) moved += await mergeTimeTasks(t.id, into.id);
    setMerging(false);
    setSelected([]);
    setNotice({ text: `Merged ${from.map((t) => t.name).join(', ')} into ${into.name}: ${entriesLabel(moved)} moved.` });
  };

  return (
    <section>
      <h2 className="section-title">Activities</h2>
      <p className="mt-2 text-sm text-fg-2">
        What time in {name} is spent on, picked when tracking time. Tick two or more to merge them.
      </p>
      {active.length === 0 ? (
        <p className="mt-3 text-base text-muted">No activities yet. They're added from the Activity picker when tracking time.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface-2">
          {active.map((t) => {
            const u = used(t.id);
            const ticked = selected.includes(t.id);
            return (
              <li key={t.id} className={`flex min-h-14 items-center gap-3 pr-1 pl-3 ${ticked ? 'bg-accent/10' : ''}`}>
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[var(--accent)]"
                  aria-label={`Select ${t.name}`}
                  checked={ticked}
                  onChange={() => toggle(t.id)}
                />
                {editing === t.id ? (
                  <ActivityName
                    name={t.name}
                    onDone={(v) => {
                      // A refused name (another activity has it) goes back to the old one, with a notice.
                      if (v !== null) rename(t, v);
                      setEditing(null);
                    }}
                  />
                ) : (
                  <span className="min-w-0 flex-1 py-2">
                    <span className="block truncate text-base font-semibold">{t.name}</span>
                    <span className="block text-sm text-fg-2 tabular-nums">
                      {entriesLabel(u.count)}
                      {u.count > 0 && ` · ${formatDuration(u.seconds)}`}
                    </span>
                  </span>
                )}
                {editing !== t.id && (
                  <>
                    <button className="btn-ghost shrink-0 px-2" aria-label={`Rename ${t.name}`} title="Rename" onClick={() => setEditing(t.id)}>
                      <PencilIcon />
                    </button>
                    <button className="btn-ghost shrink-0 px-2" aria-label={`Delete ${t.name}`} title="Delete" onClick={() => remove(t)}>
                      <XIcon />
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {picked.length >= 2 && !merging && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex-1 text-sm text-fg-2">{picked.length} selected</span>
          <button className="btn-ghost" onClick={() => setSelected([])}>Clear</button>
          <button className="btn-primary" onClick={startMerge}>Merge {picked.length}</button>
        </div>
      )}
      {merging && picked.length >= 2 && (
        <div role="group" aria-label="Merge activities" className="mt-3 flex flex-col gap-3 rounded-md border border-line-strong bg-surface p-4">
          <p className="text-base font-semibold">Keep which name?</p>
          <div className="flex flex-col gap-1">
            {picked.map((t) => (
              <label key={t.id} className="flex min-h-11 items-center gap-3 text-base">
                <input type="radio" name="keep-activity" className="h-5 w-5 accent-[var(--accent)]" checked={keep === t.id} onChange={() => setKeep(t.id)} />
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                <span className="shrink-0 text-sm text-fg-2 tabular-nums">{entriesLabel(used(t.id).count)}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-fg-2">The other entries move to it, and the others are deleted.</p>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setMerging(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => void merge()}>Merge</button>
          </div>
        </div>
      )}

      {notice && (
        <p role="status" className="mt-2 flex items-center gap-2 text-sm font-semibold text-fg-2">
          <span className="flex-1">{notice.text}</span>
          {notice.undo && <button className="btn-outline min-h-10 px-3" onClick={notice.undo}>Undo</button>}
        </p>
      )}

      {removed.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-fg-2">Deleted activities ({removed.length})</summary>
          <ul className="divide-y divide-line rounded-md border border-line">
            {removed.map((t) => (
              <li key={t.id} className="flex min-h-12 items-center gap-2 pr-1 pl-4">
                <span className="min-w-0 flex-1 truncate text-base text-fg-2">{t.name}</span>
                <span className="shrink-0 text-sm text-fg-2 tabular-nums">{entriesLabel(used(t.id).count)}</span>
                <button className="btn-ghost shrink-0 px-3" onClick={() => void restoreTimeTask(t.id)}>Restore</button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-fg-2">Deleted activities stay on their past entries but aren't offered when tracking time.</p>
        </details>
      )}
    </section>
  );
}

/** Renaming an activity: Enter or leaving the box saves, Escape or a blank name cancels (`null`). */
function ActivityName({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const [draft, setDraft] = useState(name);
  const finish = () => onDone(draft.trim() || null);
  return (
    <input
      autoFocus
      aria-label="Activity name"
      className="input min-h-11 min-w-0 flex-1"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') finish();
        else if (e.key === 'Escape') {
          // Don't let the Escape close anything around the page.
          e.stopPropagation();
          onDone(null);
        }
      }}
    />
  );
}
