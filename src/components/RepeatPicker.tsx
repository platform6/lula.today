import { useState } from 'react';
import { updateTask } from '../db/actions';
import type { Recurrence, RepeatPreset, Task } from '../db/types';
import { addDays, toDueAt, todayKey } from '../lib/dates';
import { DAY_NAMES, describe, nextDue, nthOfMonth, ordinal, presetRule } from '../lib/recurrence';
import { DateField } from './DateField';
import { ChevronRightIcon, MinusIcon, PlusIcon, RepeatIcon } from './icons';
import { Sheet } from './Sheet';

type Choice = RepeatPreset | 'none';
type Ends = 'never' | 'on' | 'after';

/** "Next: Wed, Oct 28", or what happens instead. */
function nextLine(rule: Recurrence, dueAt: string | null): string {
  if (rule.from === 'done') return 'The next one is set when you complete this one';
  const next = nextDue(rule, dueAt);
  return next ? `Next: ${next.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'This is the last one';
}

/** The task's Repeat field: the rule and next date, opening the picker on tap. */
export function RepeatField({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  const rule = task.recurrence ?? null;
  const due = task.due_at ? new Date(task.due_at) : new Date();

  return (
    <div className="col-span-2">
      <span className="field-label">Repeat</span>
      <button
        type="button"
        className={`input flex items-center gap-2.5 text-left font-semibold ${rule ? 'text-fg' : 'text-muted'}`}
        onClick={() => setOpen(true)}
      >
        <RepeatIcon className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1">{rule ? describe(rule, due) : "Doesn't repeat"}</span>
        <ChevronRightIcon className="shrink-0 text-muted" />
      </button>
      {rule && <p className="mt-1.5 text-sm text-fg-2">{nextLine(rule, task.due_at)}</p>}
      {open && <RepeatPicker task={task} onClose={() => setOpen(false)} />}
    </div>
  );
}

function RepeatPicker({ task, onClose }: { task: Task; onClose: () => void }) {
  const rule = task.recurrence ?? null;
  const due = task.due_at ? new Date(task.due_at) : new Date();
  const custom = rule?.preset === 'custom' ? rule : null;

  const [choice, setChoice] = useState<Choice>(rule?.preset ?? 'none');
  const [every, setEvery] = useState(custom?.every ?? 1);
  const [unit, setUnit] = useState<Recurrence['unit']>(custom?.unit ?? 'week');
  const [days, setDays] = useState<number[]>(custom?.days ?? [due.getDay()]);
  const [monthMode, setMonthMode] = useState<'day' | 'nth'>(custom?.month_mode ?? 'day');
  const [from, setFrom] = useState<Recurrence['from']>(rule?.from ?? 'due');
  const [ends, setEnds] = useState<Ends>(rule?.until ? 'on' : rule?.count ? 'after' : 'never');
  const [until, setUntil] = useState(rule?.until ?? addDays(todayKey(), 30));
  const [count, setCount] = useState(rule?.count ?? 5);

  const draft: Recurrence | null =
    choice === 'none'
      ? null
      : {
          ...(choice === 'custom'
            ? {
                preset: 'custom' as const,
                unit,
                every,
                from,
                ...(unit === 'week' ? { days: days.length ? days : [due.getDay()] } : {}),
                ...(unit === 'month' ? { month_mode: monthMode } : {}),
              }
            : presetRule(choice, due, from)),
          until: ends === 'on' ? until : null,
          count: ends === 'after' ? count : null,
          done: rule?.done ?? 0,
        };

  const save = () => {
    // A repeating task needs a date to repeat from: start today if it has none.
    const needsDate = draft && !task.due_at;
    void updateTask(task.id, {
      recurrence: draft,
      ...(needsDate ? { due_at: toDueAt(todayKey()), due_has_time: false } : {}),
    });
    onClose();
  };

  const presets: { key: Choice; label: string; sub?: string }[] = [
    { key: 'none', label: "Doesn't repeat" },
    { key: 'daily', label: 'Every day' },
    { key: 'weekdays', label: 'Every weekday', sub: 'Monday to Friday' },
    { key: 'weekly', label: 'Every week', sub: `On ${DAY_NAMES[due.getDay()]}s` },
    { key: 'monthly', label: 'Every month', sub: `On the ${ordinal(due.getDate())}` },
    { key: 'yearly', label: 'Every year', sub: `On ${due.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}` },
    { key: 'custom', label: 'Custom', sub: 'Choose the interval and days' },
  ];

  return (
    <Sheet
      title="Repeat"
      onClose={onClose}
      side="modal"
      footer={
        <button type="button" className="btn-primary mb-2 min-h-11 px-10 text-sm" onClick={save}>
          Done
        </button>
      }
    >
      <div className="flex flex-col gap-5 p-4">
        <div className="flex flex-col gap-0.5 rounded-md bg-surface-2 px-4 py-3">
          <span className="kicker text-xs">Repeats</span>
          <span className="text-lg font-bold">{draft ? describe(draft, due) : "Doesn't repeat"}</span>
          {draft && <span className="text-sm text-fg-2">{nextLine(draft, task.due_at)}</span>}
        </div>

        <div className="flex flex-col gap-2">
          {presets.map((p) => (
            <Option key={p.key} on={choice === p.key} onPick={() => setChoice(p.key)} label={p.label} sub={p.sub} />
          ))}
        </div>

        {choice === 'custom' && (
          <div className="flex flex-col gap-4 border-t border-line pt-4">
            <div>
              <span className="field-label">Every</span>
              <Stepper value={every} min={1} max={30} onChange={setEvery} label="interval" />
              <div className="mt-2 flex gap-1.5">
                {(['day', 'week', 'month', 'year'] as const).map((u) => (
                  <Segment key={u} on={unit === u} onPick={() => setUnit(u)}>
                    {u.charAt(0).toUpperCase() + u.slice(1)}
                    {every === 1 ? '' : 's'}
                  </Segment>
                ))}
              </div>
            </div>

            {unit === 'week' && from === 'due' && (
              <div>
                <span className="field-label">On</span>
                <div className="flex justify-between">
                  {DAY_NAMES.map((name, i) => {
                    const on = days.includes(i);
                    return (
                      <button
                        key={name}
                        type="button"
                        aria-label={name}
                        aria-pressed={on}
                        className={`grid h-11 w-11 place-items-center rounded-full border-2 text-sm font-bold ${on ? 'border-accent bg-accent text-accent-fg' : 'border-line-strong text-fg-2'}`}
                        onClick={() => setDays(on ? days.filter((d) => d !== i) : [...days, i])}
                      >
                        {name[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {unit === 'month' && from === 'due' && (
              <div>
                <span className="field-label">On</span>
                <div className="flex flex-col gap-2">
                  <Option on={monthMode === 'day'} onPick={() => setMonthMode('day')} label={`On day ${due.getDate()}`} />
                  <Option
                    on={monthMode === 'nth'}
                    onPick={() => setMonthMode('nth')}
                    label={`On the ${ordinal(nthOfMonth(due))} ${DAY_NAMES[due.getDay()]}`}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {draft && (
          <div className="flex flex-col gap-4 border-t border-line pt-4">
            <div>
              <span className="field-label">Next one counts from</span>
              <div className="flex gap-1.5">
                <Segment on={from === 'due'} onPick={() => setFrom('due')}>Due date</Segment>
                <Segment on={from === 'done'} onPick={() => setFrom('done')}>Completion</Segment>
              </div>
              <p className="mt-1.5 text-xs text-muted">
                {from === 'due'
                  ? 'Keeps a fixed schedule, even when you finish late.'
                  : 'Waits until you finish, then counts from that day.'}
              </p>
            </div>

            <div>
              <span className="field-label">Ends</span>
              <div className="flex gap-1.5">
                <Segment on={ends === 'never'} onPick={() => setEnds('never')}>Never</Segment>
                <Segment on={ends === 'on'} onPick={() => setEnds('on')}>On a date</Segment>
                <Segment on={ends === 'after'} onPick={() => setEnds('after')}>After</Segment>
              </div>
              {ends === 'on' && (
                <DateField className="mt-2" value={until} onChange={(v) => v && setUntil(v)} placeholder="End date" label="End date" />
              )}
              {ends === 'after' && (
                <div className="mt-2 flex items-center gap-2">
                  <Stepper value={count} min={1} max={99} onChange={setCount} label="times" />
                  <span className="font-semibold text-fg-2">times</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Option({ on, onPick, label, sub }: { on: boolean; onPick: () => void; label: string; sub?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-md border-2 px-3.5 py-2 text-left ${on ? 'border-accent bg-accent/15' : 'border-line-strong'}`}
    >
      <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 ${on ? 'border-accent' : 'border-line-strong'}`}>
        {on && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
      </span>
      <span className="flex flex-col">
        <span className="font-semibold">{label}</span>
        {sub && <span className="text-xs font-medium text-muted">{sub}</span>}
      </span>
    </button>
  );
}

function Segment({ on, onPick, children }: { on: boolean; onPick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`min-h-11 flex-1 rounded-md border-2 px-1.5 text-sm font-semibold ${on ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
    >
      {children}
    </button>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-outline h-12 w-12 px-0" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <MinusIcon />
      </button>
      <span className="min-w-12 text-center text-xl font-bold">{value}</span>
      <button type="button" className="btn-outline h-12 w-12 px-0" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <PlusIcon />
      </button>
    </div>
  );
}
