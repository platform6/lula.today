import { useState } from 'react';
import { useAllTasks } from '../db/hooks';
import type { Task } from '../db/types';
import { dayKey, todayKey } from '../lib/dates';
import { bankHolidays } from '../lib/bankHolidays';
import { describeShort, upcomingOccurrences } from '../lib/recurrence';
import { isLive } from '../lib/tasks';
import { PageHeader } from '../components/PageHeader';
import { TaskList } from '../components/TaskList';
import { BackIcon, ChevronRightIcon, RepeatIcon } from '../components/icons';
import { useOpenTask } from '../components/useOpenTask';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const keyOf = (y: number, m: number, d: number) => dayKey(new Date(y, m, d));

/** A month grid of scheduled tasks; tap a day to list them underneath. */
export function Calendar() {
  const tasks = useAllTasks();
  const openTask = useOpenTask();
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);

  if (!tasks) return null;

  const first = new Date(month.y, month.m, 1);
  const holidays = bankHolidays(month.y);
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const monthEnd = new Date(month.y, month.m, daysInMonth, 23, 59);

  // Open tasks on their due day, plus later occurrences of repeating ones (shown, not completable).
  const due = new Map<string, Task[]>();
  const repeats = new Map<string, Task[]>();
  const add = (map: Map<string, Task[]>, key: string, t: Task) => map.set(key, [...(map.get(key) ?? []), t]);
  for (const t of tasks) {
    if (!isLive(t) || t.completed_at || !t.due_at) continue;
    add(due, dayKey(new Date(t.due_at)), t);
    if (t.recurrence) for (const d of upcomingOccurrences(t.recurrence, t.due_at, monthEnd)) add(repeats, dayKey(d), t);
  }
  const byDue = (a: Task, b: Task) => (a.due_at! < b.due_at! ? -1 : a.due_at! > b.due_at! ? 1 : b.priority - a.priority);

  const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const shift = (by: number) => {
    const d = new Date(month.y, month.m + by, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  const goToday = () => {
    const d = new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
    setSelected(today);
  };

  const [sy, sm, sd] = selected.split('-').map(Number);
  const selectedDate = new Date(sy, sm - 1, sd);
  const selectedHoliday = (sy === month.y ? holidays : bankHolidays(sy)).get(selected);
  const dayTasks = (due.get(selected) ?? []).sort(byDue);
  const dayRepeats = repeats.get(selected) ?? [];

  return (
    <div>
      <PageHeader title="Calendar" />
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 text-lg font-bold">
            {first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </h2>
          <button className="btn-outline min-h-10 px-3 text-sm" onClick={goToday}>
            Today
          </button>
          <button className="btn-outline min-h-10 w-10 px-0" onClick={() => shift(-1)} aria-label="Previous month">
            <BackIcon />
          </button>
          <button className="btn-outline min-h-10 w-10 px-0" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRightIcon />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w, i) => (
            <span key={i} className="pb-1 text-xs font-semibold text-muted" aria-hidden="true">
              {w}
            </span>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <span key={`blank-${i}`} />;
            const key = keyOf(month.y, month.m, d);
            const count = (due.get(key)?.length ?? 0) + (repeats.get(key)?.length ?? 0);
            const isToday = key === today;
            const isSelected = key === selected;
            const weekend = i % 7 === 0 || i % 7 === 6;
            const holiday = holidays.get(key);
            return (
              <button
                key={key}
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${new Date(month.y, month.m, d).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}${holiday ? `, ${holiday}, U.S. bank holiday` : ''}${count ? `, ${count} task${count === 1 ? '' : 's'}` : ''}`}
                title={holiday}
                className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md border-2 text-sm font-semibold ${isSelected ? 'border-accent bg-accent/15' : `border-transparent hover:bg-surface-2 ${weekend ? 'bg-surface-2/60' : ''}`} ${isToday ? 'text-accent' : 'text-fg'}`}
              >
                {d}
                <span className="flex h-1.5 gap-0.5" aria-hidden="true">
                  {holiday && <span className="h-1.5 w-1.5 rotate-45 bg-ok" />}
                  {Array.from({ length: Math.min(count, 3) }, (_, j) => (
                    <span key={j} className="h-1.5 w-1.5 rounded-full bg-accent" />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span className="h-1.5 w-1.5 shrink-0 rotate-45 bg-ok" aria-hidden="true" />
          U.S. bank holiday · Weekends shaded
        </p>
      </div>

      <section className="mt-2">
        <h2 className="section-title mx-4">
          {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          {dayTasks.length + dayRepeats.length > 0 && (
            <span className="text-sm font-semibold text-fg-2">{dayTasks.length + dayRepeats.length}</span>
          )}
        </h2>
        {selectedHoliday && (
          <p className="mx-4 mb-3 border-l-4 border-ok bg-ok/10 px-3 py-2 text-sm text-fg">
            <span className="font-semibold">{selectedHoliday}</span>
            <span className="block text-xs text-muted">U.S. bank holiday</span>
          </p>
        )}
        {dayTasks.length > 0 || dayRepeats.length === 0 ? <TaskList tasks={dayTasks} empty="Nothing scheduled." /> : null}
        {dayRepeats.length > 0 && (
          <ul className="divide-y divide-line">
            {dayRepeats.map((t) => (
              <li key={t.id}>
                <button className="flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-surface-2" onClick={() => openTask(t.id)}>
                  <RepeatIcon width={20} height={20} className="shrink-0 text-accent" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words text-fg-2">{t.title}</span>
                    <span className="block text-sm text-muted">
                      Repeats {describeShort(t.recurrence!).toLowerCase()} · comes up after the current one is done
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
