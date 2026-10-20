import { useState } from 'react';
import { DownIcon, UpIcon, XIcon } from './icons';

export interface EditableColumn {
  key: string;
  name: string;
  is_done: boolean;
  taskCount?: number;
}

/**
 * Shared by project settings (backed by board_columns) and the default template
 * in Settings (backed by settings.default_columns).
 */
export function ColumnsEditor({
  columns,
  onRename,
  onToggleDone,
  onMove,
  onDelete,
  onAdd,
}: {
  columns: EditableColumn[];
  onRename: (key: string, name: string) => void;
  onToggleDone: (key: string, isDone: boolean) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onDelete: (key: string, moveTo: string | null) => void;
  onAdd: (name: string) => void;
}) {
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState('');

  return (
    <div className="flex flex-col gap-2">
      {columns.map((c, i) => (
        // name in the key remounts the uncontrolled input after a rename or reorder
        <div key={`${c.key}:${c.name}`} className="card p-2">
          <div className="flex items-center gap-1">
            <input
              className="min-w-0 flex-1 bg-transparent px-2 py-1.5 focus:outline-none"
              defaultValue={c.name}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) onRename(c.key, v);
              }}
              aria-label="Column name"
            />
            {c.taskCount !== undefined && <span className="px-1 text-xs text-muted">{c.taskCount}</span>}
            <label className="flex items-center gap-1 px-1 text-xs text-muted">
              <input
                type="checkbox"
                className="accent-[var(--accent)]"
                checked={c.is_done}
                onChange={(e) => onToggleDone(c.key, e.target.checked)}
              />
              Done
            </label>
            <button className="p-1.5 text-muted disabled:opacity-20" disabled={i === 0} onClick={() => onMove(c.key, -1)} aria-label="Move up">
              <UpIcon width={16} height={16} />
            </button>
            <button className="p-1.5 text-muted disabled:opacity-20" disabled={i === columns.length - 1} onClick={() => onMove(c.key, 1)} aria-label="Move down">
              <DownIcon width={16} height={16} />
            </button>
            <button
              className="p-1.5 text-muted hover:text-danger disabled:opacity-20"
              disabled={columns.length === 1}
              onClick={() => {
                if (c.taskCount) {
                  setDeleting(c.key);
                  setMoveTo(columns.find((o) => o.key !== c.key)?.key ?? '');
                } else onDelete(c.key, null);
              }}
              aria-label="Delete column"
            >
              <XIcon width={16} height={16} />
            </button>
          </div>
          {deleting === c.key && (
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-2 text-sm">
              <span className="text-muted">Move {c.taskCount} task{c.taskCount === 1 ? '' : 's'} to</span>
              <select className="input w-auto py-1" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
                {columns
                  .filter((o) => o.key !== c.key)
                  .map((o) => (
                    <option key={o.key} value={o.key}>{o.name}</option>
                  ))}
              </select>
              <button className="btn-danger" onClick={() => { onDelete(c.key, moveTo); setDeleting(null); }}>
                Delete column
              </button>
              <button className="btn-ghost" onClick={() => setDeleting(null)}>Cancel</button>
            </div>
          )}
        </div>
      ))}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = name.trim();
          if (!v) return;
          onAdd(v);
          setName('');
        }}
      >
        <input className="input" placeholder="New column name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={!name.trim()}>Add</button>
      </form>
    </div>
  );
}
