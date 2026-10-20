import { useState } from 'react';
import { Link } from 'react-router-dom';
import { deleteTask, updateTask } from '../db/actions';
import { useLabels, useProjectTasks, useProjects, useStepCounts, useTaskLabelMap } from '../db/hooks';
import { toDueAt, todayKey } from '../lib/dates';
import { byPosition } from '../lib/position';
import { isLive } from '../lib/tasks';
import { MoveToPicker } from '../components/MoveToSheet';
import { PageHeader } from '../components/PageHeader';
import { TaskMeta } from '../components/TaskMeta';
import { BackIcon } from '../components/icons';
import { useOpenTask } from '../components/useOpenTask';
import { InboxZero } from './Inbox';

/** One task at a time, with large targets: the fastest way to empty the Inbox on a phone. */
export function InboxSort() {
  const projects = useProjects();
  const inbox = projects?.find((p) => p.is_inbox);
  const tasks = useProjectTasks(inbox?.id);
  const stepCounts = useStepCounts();
  const labels = useLabels() ?? [];
  const labelMap = useTaskLabelMap();
  const openTask = useOpenTask();
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!projects || !tasks) return null;

  const open = tasks.filter((t) => isLive(t) && !t.completed_at).sort(byPosition);
  const queue = open.filter((t) => !skipped.has(t.id));
  const current = queue[0];

  const skip = (id: string) => {
    setConfirmDelete(false);
    setSkipped((s) => new Set(s).add(id));
  };

  const header = (
    <PageHeader
      title="Sort Inbox"
      back={
        <Link to="/inbox" className="btn-ghost -ml-2 px-2" aria-label="Back to Inbox">
          <BackIcon />
        </Link>
      }
      actions={open.length > 0 && <span className="chip">{queue.length} left</span>}
    />
  );

  if (open.length === 0) {
    return (
      <div>
        {header}
        <InboxZero />
      </div>
    );
  }

  if (!current) {
    return (
      <div>
        {header}
        <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <h2 className="text-2xl font-bold">You skipped the rest</h2>
          <p className="text-base text-fg-2">{open.length} task{open.length === 1 ? '' : 's'} still in the Inbox.</p>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={() => setSkipped(new Set())}>Go round again</button>
            <Link to="/inbox" className="btn-outline">Back to Inbox</Link>
          </div>
        </div>
      </div>
    );
  }

  const taskLabels = (labelMap?.get(current.id) ?? [])
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => !!l);

  return (
    <div>
      {header}
      <div className="mx-auto max-w-xl">
        <article className="card m-4 border-l-4 border-l-accent p-4">
          <h2 className="text-xl font-bold break-words">{current.title}</h2>
          {current.notes && <p className="mt-2 text-base whitespace-pre-wrap text-fg-2">{current.notes}</p>}
          <TaskMeta task={current} steps={stepCounts?.get(current.id)} labels={taskLabels} />
          <button className="btn-ghost -ml-3 mt-1" onClick={() => openTask(current.id)}>
            Edit details
          </button>
        </article>

        {/* keyed so the picker returns to the area list for each new task */}
        <MoveToPicker key={current.id} taskId={current.id} onMoved={() => setConfirmDelete(false)} />

        <div className="grid grid-cols-3 gap-2 border-t border-line p-4">
          <button
            className="btn-outline"
            onClick={() => {
              void updateTask(current.id, { due_at: toDueAt(todayKey()), due_has_time: false });
              skip(current.id);
            }}
          >
            Do today
          </button>
          <button className="btn-outline" onClick={() => skip(current.id)}>
            Skip
          </button>
          {confirmDelete ? (
            <button className="btn-danger border-2 border-danger" onClick={() => void deleteTask(current.id).then(() => setConfirmDelete(false))}>
              Confirm
            </button>
          ) : (
            <button className="btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
        </div>
        <p className="px-4 pb-4 text-sm text-fg-2">
          “Do today” gives it today’s due date and leaves it in the Inbox so it shows up on Today.
        </p>
      </div>
    </div>
  );
}
