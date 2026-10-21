import { Link } from 'react-router-dom';
import { useAllTasks, useInboxCount } from '../db/hooks';
import { CalendarIcon, InboxIcon } from '../components/icons';
import { BrandLockup } from '../components/Brand';
import type { Task } from '../db/types';
import { addDays, dayKey, isOverdue, todayKey } from '../lib/dates';
import { isLive } from '../lib/tasks';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';

const byDue = (a: Task, b: Task) => (a.due_at! < b.due_at! ? -1 : a.due_at! > b.due_at! ? 1 : b.priority - a.priority);

export function Today() {
  const tasks = useAllTasks();
  const inboxCount = useInboxCount();
  if (!tasks) return null;

  const today = todayKey();
  const weekEnd = addDays(today, 7);
  const dated = tasks.filter((t) => isLive(t) && t.due_at).sort(byDue);
  const day = (t: Task) => dayKey(new Date(t.due_at!));

  const overdue = dated.filter((t) => !t.completed_at && isOverdue(t.due_at, t.due_has_time) && day(t) < today);
  const dueToday = dated.filter((t) => !t.completed_at && day(t) === today);
  const upcoming = dated.filter((t) => !t.completed_at && day(t) > today && day(t) <= weekEnd);

  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div>
      <PageHeader
        actions={
          // Phones reach the calendar from here; desktop has it in the sidebar.
          <Link to="/calendar" className="btn-outline min-h-10 px-3 text-sm md:hidden">
            <CalendarIcon width={18} height={18} /> Calendar
          </Link>
        }
        title={
          <>
            {/* the main page carries the brand on phones; desktop shows it in the sidebar */}
            <span className="flex md:hidden">
              <BrandLockup size={32} />
            </span>
            <span className="hidden md:inline">Today</span>
          </>
        }
      />
      <p className="px-4 pt-4 text-base text-fg-2 italic">{date}</p>
      {inboxCount > 0 && (
        <Link to="/inbox" className="card mx-4 mt-4 flex min-h-14 items-center gap-3 border-2 border-accent px-4 py-3 hover:bg-surface-2">
          <InboxIcon />
          <span className="flex-1 text-base font-semibold">
            {inboxCount} task{inboxCount === 1 ? '' : 's'} in your Inbox to sort
          </span>
          <span className="kicker">Sort ›</span>
        </Link>
      )}
      {overdue.length > 0 && <Section title="Overdue" tone="text-danger" tasks={overdue} />}
      <Section title="Today" tasks={dueToday} empty="Nothing due today." />
      <Section title="Next 7 days" tasks={upcoming} empty="Nothing due this week." />
    </div>
  );
}

function Section({ title, tasks, empty, tone = '' }: { title: string; tasks: Task[]; empty?: string; tone?: string }) {
  return (
    <section className="mt-6">
      <h2 className={`section-title mx-4 ${tone}`}>
        {title} {tasks.length > 0 && <span className="text-sm font-semibold text-fg-2">{tasks.length}</span>}
      </h2>
      <TaskList tasks={tasks} empty={empty} />
    </section>
  );
}
