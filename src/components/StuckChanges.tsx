import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { dexieKey, syncTable } from '../db/db';
import type { SyncTable } from '../db/types';
import { clockLabel } from '../lib/dates';
import { dropChange, syncNow, type StuckChange } from '../sync/engine';

const KIND: Partial<Record<SyncTable, string>> = {
  areas: 'Realm',
  projects: 'Project',
  board_columns: 'Column',
  tasks: 'Task',
  steps: 'Step',
  attachments: 'Attachment',
  labels: 'Tag',
  task_labels: 'Tag on a task',
  settings: 'Settings',
  lists: 'List',
  list_items: 'List entry',
  work_days: 'Work log day',
  bus_purchases: 'Bus tickets',
  time_tags: 'Time tag',
  time_fields: 'Time field',
  time_tasks: 'Time task',
  time_entries: 'Time entry',
};

/** A row's name for people: its title, name or description, else its id. */
function useRowName(table: SyncTable, key: string): string {
  const row = useLiveQuery(() => syncTable(table).get(dexieKey(table, key) as never), [table, key]) as
    | Record<string, unknown>
    | undefined;
  const name = ['title', 'name', 'description', 'text'].map((f) => row?.[f]).find((v) => typeof v === 'string' && v.trim());
  return (name as string | undefined) ?? key.slice(0, 8);
}

/** Changes the server keeps refusing: what they are, why, and retry or drop each one. */
export function StuckChanges({ stuck }: { stuck: StuckChange[] }) {
  if (stuck.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="font-semibold text-danger">
        {stuck.length === 1 ? '1 change' : `${stuck.length} changes`} can't upload
      </p>
      <p className="text-sm text-fg-2">
        They stay on this device and are tried again on their own. Dropping one throws away this device's edits to it and
        keeps the server's copy.
      </p>
      <ul className="flex flex-col gap-2">
        {stuck.map((s) => (
          <StuckRow key={`${s.table}:${s.key}`} change={s} />
        ))}
      </ul>
    </div>
  );
}

function StuckRow({ change: s }: { change: StuckChange }) {
  const name = useRowName(s.table, s.key);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const drop = async () => {
    setBusy(true);
    setProblem(null);
    try {
      await dropChange(s.table, s.key);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <li className="flex flex-col gap-2 rounded-md border border-line bg-surface-2 p-3 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-fg">{KIND[s.table] ?? s.table}</span>
        <span className="min-w-0 flex-1 truncate text-fg-2">{name}</span>
      </div>
      <p className="font-mono text-xs break-words text-danger">{s.error}</p>
      <p className="text-xs text-fg-2">
        Tried {s.attempts === 1 ? 'once' : `${s.attempts} times`}; next try {clockLabel(new Date(s.retryAt).toISOString())}.
      </p>
      {problem && <p className="text-danger">{problem}</p>}
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1">Drop this change?</span>
          <button className="btn-outline min-h-11 px-3" disabled={busy} onClick={() => setConfirming(false)}>
            Keep it
          </button>
          <button className="btn min-h-11 border-2 border-danger px-3 text-danger" disabled={busy} onClick={() => void drop()}>
            Drop change
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button className="btn-outline min-h-11 px-3" onClick={() => void syncNow({ force: true })}>
            Retry
          </button>
          <button className="btn-ghost min-h-11 px-3" onClick={() => setConfirming(true)}>
            Drop…
          </button>
        </div>
      )}
    </li>
  );
}
