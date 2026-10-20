import { useState } from 'react';
import {
  addStep,
  archiveTask,
  deleteStep,
  deleteTask,
  moveStep,
  moveTask,
  moveTaskToProject,
  restoreTask,
  setTaskLabel,
  updateStep,
  updateTask,
} from '../db/actions';
import { useColumns, useLabels, useProjects, useSteps, useTask, useTaskLabelMap } from '../db/hooks';
import type { Priority, Step, Task } from '../db/types';
import { dueDateInput, dueTimeInput, toDueAt } from '../lib/dates';
import { PRIORITY_LABELS, isArchived, normalizeUrl } from '../lib/tasks';
import { DownIcon, LinkIcon, UpIcon, XIcon } from './icons';
import { Sheet } from './Sheet';

export function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const task = useTask(id);
  if (task === undefined) return null; // loading
  if (task === null) {
    return (
      <Sheet title="Task" onClose={onClose}>
        <p className="p-4 text-muted">This task no longer exists.</p>
      </Sheet>
    );
  }
  // Keyed so uncontrolled inputs reset when switching tasks.
  return <TaskDetails key={task.id} task={task} onClose={onClose} />;
}

function TaskDetails({ task, onClose }: { task: Task; onClose: () => void }) {
  const projects = (useProjects() ?? []).filter((p) => !p.archived_at || p.id === task.project_id);
  const columns = useColumns(task.project_id) ?? [];
  const archived = isArchived(task);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = (changes: Partial<Task>) => void updateTask(task.id, changes);

  return (
    <Sheet title={archived ? 'Archived task' : 'Task'} onClose={onClose}>
      <div className="flex flex-col gap-4 p-4">
        <textarea
          className="input resize-none text-lg font-medium"
          rows={2}
          defaultValue={task.title}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== task.title) save({ title: v });
          }}
          aria-label="Title"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label">Project</label>
            <select
              className="input"
              value={task.project_id}
              onChange={(e) => void moveTaskToProject(task.id, e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Column</label>
            <select className="input" value={task.column_id} onChange={(e) => void moveTask(task.id, e.target.value)}>
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
              <a className="btn-ghost shrink-0" href={task.url} target="_blank" rel="noopener noreferrer" aria-label="Open link">
                <LinkIcon />
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
        <Labels taskId={task.id} />

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {archived ? (
            <button className="btn-ghost" onClick={() => void restoreTask(task)}>Restore</button>
          ) : (
            <button className="btn-ghost" onClick={() => void archiveTask(task.id).then(onClose)}>Archive</button>
          )}
          <div className="flex-1" />
          {confirmDelete ? (
            <>
              <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="btn-danger" onClick={() => void deleteTask(task.id).then(onClose)}>Confirm delete</button>
            </>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
          )}
        </div>
        <p className="text-xs text-muted">
          Created {new Date(task.created_at).toLocaleString()}
          {task.completed_at && ` · Completed ${new Date(task.completed_at).toLocaleDateString()}`}
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
    <div>
      <label className="field-label">Due</label>
      <div className="flex gap-1">
        <input type="date" className="input min-w-0 px-2" value={date} onChange={(e) => set(e.target.value, time)} />
        {date && (
          <input
            type="time"
            className="input w-24 shrink-0 px-2"
            value={time}
            onChange={(e) => set(date, e.target.value)}
            aria-label="Due time"
          />
        )}
      </div>
    </div>
  );
}

function Steps({ taskId }: { taskId: string }) {
  const steps = useSteps(taskId) ?? [];
  const [text, setText] = useState('');
  const done = steps.filter((s) => s.is_done).length;

  return (
    <div>
      <label className="field-label">
        Steps {steps.length > 0 && <span className="normal-case">· {done}/{steps.length}</span>}
      </label>
      <ul className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <StepRow key={s.id} step={s} first={i === 0} last={i === steps.length - 1} />
        ))}
      </ul>
      <form
        className="mt-1"
        onSubmit={(e) => {
          e.preventDefault();
          const v = text.trim();
          if (!v) return;
          void addStep(taskId, v);
          setText('');
        }}
      >
        <input
          className="input"
          placeholder="Add a step…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
        />
      </form>
    </div>
  );
}

function StepRow({ step, first, last }: { step: Step; first: boolean; last: boolean }) {
  return (
    <li className="group flex items-center gap-2 rounded-lg px-1 hover:bg-surface-2">
      <input
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-[var(--accent)]"
        checked={step.is_done}
        onChange={(e) => void updateStep(step.id, { is_done: e.target.checked })}
      />
      <input
        className={`min-w-0 flex-1 bg-transparent py-1.5 focus:outline-none ${step.is_done ? 'text-muted line-through' : ''}`}
        defaultValue={step.text}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== step.text) void updateStep(step.id, { text: v });
        }}
      />
      <button className="p-1 text-muted disabled:opacity-20" disabled={first} onClick={() => void moveStep(step.task_id, step.id, -1)} aria-label="Move up">
        <UpIcon width={16} height={16} />
      </button>
      <button className="p-1 text-muted disabled:opacity-20" disabled={last} onClick={() => void moveStep(step.task_id, step.id, 1)} aria-label="Move down">
        <DownIcon width={16} height={16} />
      </button>
      <button className="p-1 text-muted hover:text-danger" onClick={() => void deleteStep(step.id)} aria-label="Delete step">
        <XIcon width={16} height={16} />
      </button>
    </li>
  );
}

function Labels({ taskId }: { taskId: string }) {
  const labels = useLabels() ?? [];
  const active = new Set(useTaskLabelMap()?.get(taskId) ?? []);
  if (labels.length === 0) {
    return <p className="text-xs text-muted">Create labels in Settings to tag tasks.</p>;
  }
  return (
    <div>
      <label className="field-label">Labels</label>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((l) => {
          const on = active.has(l.id);
          return (
            <button
              key={l.id}
              className={`rounded-full border px-2.5 py-1 text-sm ${on ? 'border-transparent' : 'border-line text-muted'}`}
              style={on ? { background: `color-mix(in srgb, ${l.color ?? 'var(--muted)'} 25%, transparent)`, color: l.color ?? undefined } : undefined}
              onClick={() => void setTaskLabel(taskId, l.id, !on)}
            >
              {l.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
