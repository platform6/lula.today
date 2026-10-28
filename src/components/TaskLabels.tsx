import { useState } from 'react';
import { setTaskLabel, tagTask } from '../db/actions';
import { useLabels, useTaskLabelMap } from '../db/hooks';
import { COLORS } from './ColorPicker';
import { PlusIcon, XIcon } from './icons';

export function TaskLabels({ taskId }: { taskId: string }) {
  const labels = useLabels() ?? [];
  const active = new Set(useTaskLabelMap()?.get(taskId) ?? []);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const applied = labels.filter((l) => active.has(l.id));
  const query = name.trim().toLowerCase();
  // Only the tags you're looking for: unapplied ones matching what's typed (a few to start).
  const suggestions = labels
    .filter((l) => !active.has(l.id) && l.name.toLowerCase().includes(query))
    .slice(0, query ? 8 : 5);
  const exact = labels.some((l) => l.name.trim().toLowerCase() === query);

  const close = () => {
    setAdding(false);
    setName('');
  };
  const add = (v: string) => {
    if (!v.trim()) return;
    // new tags take the next palette color, as in Settings
    void tagTask(taskId, v, COLORS[labels.length % COLORS.length]);
    close();
  };

  return (
    <div>
      <span className="field-label">Tags</span>
      <div className="flex flex-wrap gap-1.5">
        {applied.map((l) => (
          <button
            key={l.id}
            className="flex min-h-11 items-center gap-2 rounded-sm border-2 border-line-strong px-3 text-sm font-semibold text-fg"
            onClick={() => void setTaskLabel(taskId, l.id, false)}
            aria-label={`Remove tag ${l.name}`}
          >
            <span className="h-3 w-3 rounded-full" style={{ background: l.color ?? 'var(--muted)' }} />
            {l.name}
            <XIcon width={16} height={16} className="text-fg-2" />
          </button>
        ))}
        {!adding && (
          <button className="btn-outline flex min-h-11 items-center gap-1.5 px-3 text-sm" onClick={() => setAdding(true)}>
            <PlusIcon width={16} height={16} /> Add tag
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Enter picks the first match, or creates the tag if nothing matches.
              add(suggestions[0] && !exact ? suggestions[0].name : name);
            }}
          >
            <input
              className="input"
              placeholder={labels.length ? 'Find or create a tag' : 'Name your first tag'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && close()}
              enterKeyHint="done"
              aria-label="Find or create a tag"
              autoFocus
            />
            <button type="button" className="btn-outline shrink-0 px-3" onClick={close}>
              Cancel
            </button>
          </form>
          {(suggestions.length > 0 || (query && !exact)) && (
            <ul className="mt-1.5 flex flex-col rounded-sm border-2 border-line-strong">
              {suggestions.map((l) => (
                <li key={l.id}>
                  <button
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold hover:bg-surface-2"
                    onClick={() => add(l.name)}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: l.color ?? 'var(--muted)' }} />
                    {l.name}
                  </button>
                </li>
              ))}
              {query && !exact && (
                <li>
                  <button
                    className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm font-semibold text-accent hover:bg-surface-2"
                    onClick={() => add(name)}
                  >
                    <PlusIcon width={16} height={16} /> Create &ldquo;{name.trim()}&rdquo;
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
