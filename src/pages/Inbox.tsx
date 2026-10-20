import { Link } from 'react-router-dom';
import { useProjectTasks, useProjects } from '../db/hooks';
import { byPosition } from '../lib/position';
import { isLive } from '../lib/tasks';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';
import { CheckIcon } from '../components/icons';

/** The staging ground: everything captured lands here and gets sorted out. */
export function Inbox() {
  const projects = useProjects();
  const inbox = projects?.find((p) => p.is_inbox);
  const tasks = useProjectTasks(inbox?.id);

  if (!projects || !tasks) return null;
  if (!inbox) return <p className="p-4 text-base text-muted">Setting up your Inbox… this needs one sync while online.</p>;

  const open = tasks.filter((t) => isLive(t) && !t.completed_at).sort(byPosition);

  return (
    <div>
      <PageHeader
        title="Inbox"
        actions={
          open.length > 0 && (
            <Link to="/inbox/sort" className="btn-primary">
              Sort {open.length}
            </Link>
          )
        }
      />
      {open.length === 0 ? (
        <InboxZero />
      ) : (
        <>
          <p className="px-4 pt-4 text-base text-fg-2">
            Everything you capture lands here. Move each task to an area or one of its projects.
          </p>
          <TaskList tasks={open} showPlace={false} showMove />
        </>
      )}
    </div>
  );
}

export function InboxZero() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-accent text-accent-fg">
        <CheckIcon width={44} height={44} strokeWidth={3} />
      </span>
      <h2 className="text-2xl font-bold">Inbox zero</h2>
      <p className="max-w-xs text-base text-fg-2">Everything is sorted. Tap + to capture something new.</p>
      <Link to="/" className="btn-outline mt-2">Go to Today</Link>
    </div>
  );
}
