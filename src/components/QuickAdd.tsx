import { useEffect, useRef, useState } from 'react';
import { createTask } from '../db/actions';
import { useProjects } from '../db/hooks';
import type { Priority } from '../db/types';
import { toDueAt } from '../lib/dates';
import { PRIORITY_LABELS } from '../lib/tasks';
import { WitchHatIcon } from './icons';
import { Sheet } from './Sheet';
import { DateField } from './DateField';

/**
 * One-step capture: type a title, press Enter. Everything goes to the Inbox,
 * whatever page you're on; sorting into realms and projects happens there.
 */
export function QuickAdd({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (taskId: string, openDetails: boolean) => void;
}) {
  const inbox = useProjects()?.find((p) => p.is_inbox);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  // Saving closes the sheet (the parent unmounts it); tap + again for the next task.
  async function submit(openDetails: boolean) {
    const text = title.trim();
    if (!text || !inbox || saving) return;
    setSaving(true);
    const task = await createTask({
      title: text,
      project_id: inbox.id,
      priority,
      due_at: toDueAt(due),
      atTop: true,
    });
    onCreated(task.id, openDetails);
  }

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <WitchHatIcon /> Add to Sorting
        </span>
      }
      onClose={onClose}
      side="center"
    >
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <input
          ref={inputRef}
          className="input text-lg font-semibold"
          placeholder="What do you need to do?"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          enterKeyHint="done"
        />
        <div className="grid grid-cols-2 gap-2">
          <DateField value={due} onChange={setDue} placeholder="Due date" label="Due date" />
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
          <span className="flex-1" />
          <button type="button" className="btn-ghost" disabled={!title.trim() || saving} onClick={() => void submit(true)}>
            Add &amp; open
          </button>
          <button type="submit" className="btn-primary" disabled={!title.trim() || saving || !inbox}>
            Add
          </button>
        </div>
      </form>
    </Sheet>
  );
}
