import { useEffect, useMemo, useState } from 'react';
import { useTimeEntries, useTimeTasks } from '../db/hooks';
import { mergeTimeTasks, removeTimeTask, renameTimeTask, restoreTimeTask } from '../db/time';
import type { TimeTask } from '../db/types';
import { entrySeconds, formatDuration, nameKey } from '../lib/time';
import { XIcon } from './icons';

/**
 * A project's activities (its own list's, for a realm): rename one, merge one into
 * another (its entries move over), or remove one from the pickers and bring it back.
 */
export function ActivitiesEditor({ projectId, name }: { projectId: string; name: string }) {
  const all = (useTimeTasks() ?? []).filter((t) => t.project_id === projectId);
  const entries = useTimeEntries();
  const [merging, setMerging] = useState<{ from: TimeTask; into: TimeTask } | null>(null);
  const [notice, setNotice] = useState('');

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

  const rename = (t: TimeTask, next: string): boolean => {
    const twin = active.find((o) => o.id !== t.id && nameKey(o.name) === nameKey(next));
    if (twin) {
      setNotice(`Another activity is already called ${twin.name}. To combine them, use Merge into.`);
      return false;
    }
    setNotice('');
    void renameTimeTask(t.id, next);
    return true;
  };

  return (
    <section>
      <h2 className="section-title">Activities</h2>
      <p className="mt-2 text-sm text-fg-2">
        What time in {name} is spent on, picked when tracking time. Rename one to fix a typo, or merge two into one.
      </p>
      {active.length === 0 ? (
        <p className="mt-3 text-base text-muted">No activities yet. They're added from the Activity picker when tracking time.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-surface-2">
          {active.map((t) => {
            const u = used(t.id);
            const others = active.filter((o) => o.id !== t.id);
            return (
              <li key={t.id} className="flex flex-col gap-1 py-2 pr-1 pl-4">
                <div className="flex min-h-12 items-center gap-2">
                  <label className="sr-only" htmlFor={`activity-${t.id}`}>Activity name</label>
                  <ActivityName id={`activity-${t.id}`} name={t.name} onSave={(v) => rename(t, v)} />
                  <button className="btn-ghost shrink-0 px-2" aria-label={`Remove ${t.name}`} title="Remove from the pickers" onClick={() => void removeTimeTask(t.id)}>
                    <XIcon />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pr-3 text-sm text-fg-2">
                  <span className="flex-1 tabular-nums">
                    {entriesLabel(u.count)}
                    {u.count > 0 && ` · ${formatDuration(u.seconds)}`}
                  </span>
                  {others.length > 0 && (
                    <label className="flex items-center gap-2">
                      <span>Merge into</span>
                      <select
                        className="input min-h-10 w-auto py-1 text-sm"
                        value=""
                        onChange={(e) => {
                          const into = others.find((o) => o.id === e.target.value);
                          if (into) setMerging({ from: t, into });
                        }}
                      >
                        <option value="">Choose…</option>
                        {others.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {merging?.from.id === t.id && (
                  <div role="alert" className="mt-1 mr-3 flex flex-wrap items-center gap-2 rounded-md border border-line-strong bg-surface p-3">
                    <p className="min-w-48 flex-1 text-base">
                      Move {entriesLabel(u.count)} from <b>{t.name}</b> to <b>{merging.into.name}</b>, and remove {t.name}?
                    </p>
                    <button className="btn-ghost" onClick={() => setMerging(null)}>Cancel</button>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const { from, into } = merging;
                        setMerging(null);
                        void mergeTimeTasks(from.id, into.id).then((n) =>
                          setNotice(`Merged ${from.name} into ${into.name}: ${entriesLabel(n)} moved.`),
                        );
                      }}
                    >
                      Merge
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {notice && <p role="status" className="mt-2 text-sm font-semibold text-fg-2">{notice}</p>}
      {removed.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-fg-2">Removed activities ({removed.length})</summary>
          <ul className="divide-y divide-line rounded-md border border-line">
            {removed.map((t) => (
              <li key={t.id} className="flex min-h-12 items-center gap-2 pr-1 pl-4">
                <span className="min-w-0 flex-1 truncate text-base text-fg-2">{t.name}</span>
                <span className="shrink-0 text-sm text-fg-2 tabular-nums">{entriesLabel(used(t.id).count)}</span>
                <button className="btn-ghost shrink-0 px-3" onClick={() => void restoreTimeTask(t.id)}>Restore</button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-fg-2">Removed activities stay on their past entries but aren't offered when tracking time.</p>
        </details>
      )}
    </section>
  );
}

/** An activity's name, saved when you leave the box; a blank or refused name goes back to the old one. */
function ActivityName({ id, name, onSave }: { id: string; name: string; onSave: (name: string) => boolean }) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  return (
    <input
      id={id}
      className="min-h-12 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft.trim();
        if (!v || (v !== name && !onSave(v))) setDraft(name);
      }}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />
  );
}
