import { useState } from 'react';
import {
  archiveTask,
  cancelTask,
  createProject,
  deleteTask,
  moveTask,
  moveTaskToProject,
  restoreTask,
  setTaskCompleted,
  updateTask,
} from '../db/actions';
import { useAreas, useColumns, useProject, useTask } from '../db/hooks';
import { ProjectSelect } from './ProjectSelect';
import { DateField } from './DateField';
import { useConfirmComplete } from './ConfirmComplete';
import type { Priority, Task } from '../db/types';
import { dueDateInput, dueTimeInput, toDueAt } from '../lib/dates';
import { PRIORITY_LABELS, isArchived, normalizeUrl } from '../lib/tasks';
import { CheckIcon, CopyIcon, LinkIcon, PlusIcon } from './icons';
import { RepeatField } from './RepeatPicker';
import { Sheet } from './Sheet';
import { CardTimer } from './Timer';
import { Attachments } from './TaskAttachments';
import { TaskLabels } from './TaskLabels';
import { Steps } from './TaskSteps';

export function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const task = useTask(id);
  if (task === undefined) return null; // loading
  if (task === null) {
    return (
      <Sheet title="Task" onClose={onClose} side="modal">
        <p className="p-4 text-muted">This task no longer exists.</p>
      </Sheet>
    );
  }
  // Keyed so uncontrolled inputs reset when switching tasks.
  return <TaskDetails key={task.id} task={task} onClose={onClose} />;
}

const actionBtn = 'btn border-2 border-fg hover:bg-surface-2';

function TaskDetails({ task, onClose }: { task: Task; onClose: () => void }) {
  const inInbox = !!useProject(task.project_id)?.is_inbox;
  const columns = useColumns(task.project_id) ?? [];
  const archived = isArchived(task);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (changes: Partial<Task>) => void updateTask(task.id, changes);
  const confirmComplete = useConfirmComplete();

  async function changeColumn(columnId: string) {
    const completing = !task.completed_at && !!columns.find((c) => c.id === columnId)?.is_done;
    if (completing && !(await confirmComplete(task))) return;
    await moveTask(task.id, columnId);
    // A completed task is finished with: close it, as the celebration plays.
    if (completing) onClose();
  }

  // Fields save as you leave them; blurring the focused one commits it before closing.
  const saveAndClose = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    onClose();
  };

  async function complete() {
    if (!(await confirmComplete(task))) return;
    saveAndClose();
    await setTaskCompleted(task, true);
  }

  return (
    <Sheet
      title={task.cancelled_at ? 'Cancelled task' : archived ? 'Archived task' : 'Task'}
      onClose={onClose}
      side="modal"
      footer={
        <div className="mb-2 flex gap-2">
          {!task.completed_at && !archived && (
            <button type="button" className="btn-outline min-h-10 gap-1.5 px-5 text-sm" onClick={() => void complete()}>
              <CheckIcon width={18} height={18} strokeWidth={3} /> Complete
            </button>
          )}
          <button type="button" className="btn-primary min-h-10 px-8 text-sm" onClick={saveAndClose}>
            Save
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 p-4">
        <textarea
          className="input resize-none text-xl font-bold"
          rows={2}
          defaultValue={task.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== task.title) save({ title: v });
          }}
          aria-label="Title"
        />

        {!archived && <CardTimer task={task} />}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <span className="field-label">Realm | Project</span>
            <ProjectSelect value={task.project_id} onChange={(id) => void moveTaskToProject(task.id, id)} ariaLabel="Realm or project" />
            <NewProjectForm task={task} />
          </div>
          <div className={inInbox ? 'hidden' : ''}>
            <label className="field-label">Column</label>
            <select className="input" value={task.column_id} onChange={(e) => void changeColumn(e.target.value)}>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}{c.is_done ? ' ✓' : ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Priority</label>
            <select
              className="input"
              value={task.priority}
              onChange={(e) => save({ priority: Number(e.target.value) as Priority })}
            >
              {PRIORITY_LABELS.map((l, i) => (
                <option key={l} value={i}>{l}</option>
              ))}
            </select>
          </div>
          <DueFields task={task} />
          {!archived && <RepeatField task={task} />}
        </div>

        <div>
          <label className="field-label">Link</label>
          <div className="flex gap-2">
            <input
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://…"
              defaultValue={task.url ?? ''}
              onBlur={(e) => {
                const url = normalizeUrl(e.target.value);
                if (url !== task.url) save({ url });
              }}
            />
            {task.url && (
              <a className="btn-outline shrink-0" href={task.url} target="_blank" rel="noopener noreferrer" aria-label="Open link">
                <LinkIcon /> Open
              </a>
            )}
          </div>
        </div>

        <div>
          <label className="field-label">Notes</label>
          <textarea
            className="input min-h-24"
            rows={4}
            defaultValue={task.notes ?? ''}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== task.notes) save({ notes: v });
            }}
          />
        </div>

        <Steps taskId={task.id} />
        <Attachments taskId={task.id} />
        <TaskLabels taskId={task.id} />

        {/* Two equal buttons: what fits the task's state, then Delete. */}
        <div className="grid grid-cols-2 gap-2 border-t border-line pt-4">
          {confirmDelete ? (
            <>
              <button className={actionBtn} onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button className={`${actionBtn} text-danger`} onClick={() => void deleteTask(task.id).then(onClose)}>
                Confirm delete
              </button>
            </>
          ) : (
            <>
              {archived ? (
                <button className={actionBtn} onClick={() => void restoreTask(task)}>
                  Restore
                </button>
              ) : task.completed_at ? (
                // Completed tasks archive themselves after 7 days; this clears one now.
                <button className={actionBtn} onClick={() => void archiveTask(task.id).then(onClose)}>
                  Archive
                </button>
              ) : (
                <button className={actionBtn} onClick={() => void cancelTask(task.id).then(onClose)}>
                  Cancel task
                </button>
              )}
              <button className={`${actionBtn} text-danger`} onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          Id <CopyId id={task.id} />
        </div>
        <p className="-mt-2 text-sm text-muted">
          Created {new Date(task.created_at).toLocaleString()}
          {task.completed_at && ` · Completed ${new Date(task.completed_at).toLocaleDateString()}`}
          {task.cancelled_at && ` · Cancelled ${new Date(task.cancelled_at).toLocaleDateString()}`}
        </p>
      </div>
    </Sheet>
  );
}

function DueFields({ task }: { task: Task }) {
  const date = dueDateInput(task.due_at);
  const time = dueTimeInput(task.due_at, task.due_has_time);

  const set = (nextDate: string, nextTime: string) =>
    void updateTask(task.id, {
      due_at: toDueAt(nextDate, nextTime || undefined),
      due_has_time: !!nextDate && !!nextTime,
    });

  return (
    <div className="col-span-2">
      <span className="field-label">Due</span>
      <div className="flex flex-wrap gap-2">
        <DateField
          className="min-w-44 flex-1"
          value={date}
          onChange={(d) => set(d, d ? time : '')}
          placeholder="Add due date"
          label="Due date"
        />
        {date && (
          <DateField
            kind="time"
            className="min-w-36 flex-1"
            value={time}
            onChange={(t) => set(date, t)}
            placeholder="Add time"
            label="Due time"
          />
        )}
      </div>
    </div>
  );
}

function NewProjectForm({ task }: { task: Task }) {
  const areas = useAreas() ?? [];
  const currentArea = useProject(task.project_id)?.area_id;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');

  if (!open) {
    return (
      <button type="button" className="btn-ghost mt-1 -ml-3 min-h-10 gap-1.5 text-sm" onClick={() => setOpen(true)}>
        <PlusIcon width={16} height={16} /> New project
      </button>
    );
  }
  if (areas.length === 0) {
    return <p className="mt-2 text-sm text-fg-2">Create a realm first (Realms tab), then add projects to it.</p>;
  }

  const realm = areaId || (areas.some((a) => a.id === currentArea) ? currentArea! : areas[0].id);
  const close = () => {
    setOpen(false);
    setName('');
    setAreaId('');
  };

  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-sm border-2 border-line-strong p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = name.trim();
        if (!v) return;
        const project = await createProject({ name: v, area_id: realm });
        await moveTaskToProject(task.id, project.id);
        close();
      }}
    >
      <select className="input" value={realm} onChange={(e) => setAreaId(e.target.value)} aria-label="Realm">
        {areas.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      <input
        className="input"
        placeholder="Project name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        enterKeyHint="done"
        aria-label="Project name"
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-ghost min-h-10 text-sm" onClick={close}>
          Cancel
        </button>
        <button className="btn-primary min-h-10 px-4 text-sm" disabled={!name.trim()}>
          Create and move
        </button>
      </div>
    </form>
  );
}

/**
 * The task's short id (as the board script shows it), so a card can be named
 * exactly when asking Claude to work on it. Tap to copy.
 */
function CopyId({ id }: { id: string }) {
  const short = id.slice(0, 8);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(short);
      setState('copied');
    } catch {
      setState('failed');
    }
    setTimeout(() => setState('idle'), 1500);
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="flex min-h-9 items-center gap-1.5 rounded-sm border border-line-strong px-2 font-mono text-xs font-medium text-fg-2 hover:border-fg hover:text-fg"
      aria-label={`Copy task id ${short}`}
      title="Copy id"
    >
      {short}
      {state === 'copied' ? (
        <CheckIcon width={14} height={14} strokeWidth={3} className="text-ok" />
      ) : (
        <CopyIcon width={14} height={14} />
      )}
      <span role="status" className={state === 'failed' ? 'font-sans text-danger' : 'sr-only'}>
        {state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : ''}
      </span>
    </button>
  );
}
