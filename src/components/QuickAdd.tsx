import { useEffect, useRef, useState } from 'react';
import { createTask } from '../db/actions';
import { useAreas, useProjects } from '../db/hooks';
import type { Priority } from '../db/types';
import { toDueAt } from '../lib/dates';
import { PRIORITY_LABELS } from '../lib/tasks';
import { Sheet } from './Sheet';

/** One-step capture: type a title, press Enter. Other fields are optional. */
export function QuickAdd({
  defaultProjectId,
  onClose,
  onCreated,
}: {
  defaultProjectId?: string;
  onClose: () => void;
  onCreated: (taskId: string, openDetails: boolean) => void;
}) {
  const projects = (useProjects() ?? []).filter((p) => !p.archived_at);
  const areas = useAreas() ?? [];
  const inbox = projects.find((p) => p.is_inbox);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [added, setAdded] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const target = projectId || inbox?.id || '';

  async function submit(openDetails: boolean) {
    const text = title.trim();
    if (!text || !target) return;
    const task = await createTask({
      title: text,
      project_id: target,
      priority,
      due_at: toDueAt(due),
      atTop: true,
    });
    setTitle('');
    setAdded((n) => n + 1);
    onCreated(task.id, openDetails);
    inputRef.current?.focus();
  }

  const areaName = (id: string | null) => areas.find((a) => a.id === id)?.name;

  return (
    <Sheet title="New task" onClose={onClose} side="center">
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <input
          ref={inputRef}
          className="input text-base"
          placeholder="What do you need to do?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          enterKeyHint="done"
        />
        <div className="grid grid-cols-3 gap-2">
          <select className="input col-span-3 sm:col-span-1" value={target} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.is_inbox ? 'Inbox' : areaName(p.area_id) ? `${areaName(p.area_id)} / ${p.name}` : p.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="input col-span-2 sm:col-span-1"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            aria-label="Due date"
          />
          <select
            className="input"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value) as Priority)}
            aria-label="Priority"
          >
            {PRIORITY_LABELS.map((l, i) => (
              <option key={l} value={i}>{i === 0 ? 'Priority' : l}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-xs text-muted">{added > 0 && `Added ${added}. Keep typing to add more.`}</span>
          <button type="button" className="btn-ghost" disabled={!title.trim()} onClick={() => void submit(true)}>
            Add &amp; open
          </button>
          <button type="submit" className="btn-primary" disabled={!title.trim()}>
            Add
          </button>
        </div>
      </form>
    </Sheet>
  );
}
