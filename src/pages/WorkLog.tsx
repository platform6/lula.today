import { useState } from 'react';
import { Link } from 'react-router-dom';
import { addBusPurchase, setWorkDay } from '../db/actions';
import { useBusPurchases, useWorkDays } from '../db/hooks';
import type { WorkStatus } from '../db/types';
import { dayKey, todayKey } from '../lib/dates';
import { LOW_TICKETS, PACK_SIZE, TICKETS_PER_OFFICE_DAY, WORK_STATUSES, statusInfo, summarize, ticketsLeft } from '../lib/worklog';
import { PageHeader } from '../components/PageHeader';
import { BackIcon, ChevronRightIcon, PrinterIcon } from '../components/icons';

/** Where each day was worked, the in-office percentage, and bus tickets left. */
export function WorkLog() {
  const days = useWorkDays();
  const purchases = useBusPurchases();
  const today = todayKey();
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  if (!days || !purchases) return null;

  const byDay = new Map(days.map((d) => [d.day, d.status]));
  const summary = summarize(days, month.y);
  const tickets = ticketsLeft(purchases, days, today);

  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(month.y, month.m, i + 1)));
  const shift = (by: number) => {
    const d = new Date(month.y, month.m + by, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div>
      <PageHeader
        title="Work log"
        actions={
          <Link to={`/work/print/${month.y}`} className="btn-outline min-h-10 px-3 text-sm">
            <PrinterIcon width={18} height={18} /> Print {month.y}
          </Link>
        }
      />
      <div className="mx-auto flex max-w-2xl flex-col gap-6 p-4">
        <BusTickets left={tickets} />

        <section>
          <h2 className="section-title">
            Today
            <span className="text-sm font-semibold text-fg-2">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </h2>
          <StatusPicker value={byDay.get(today)} onPick={(s) => void setWorkDay(today, s)} />
        </section>

        <section>
          <h2 className="section-title">{month.y}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {WORK_STATUSES.map((s) => (
              <div key={s.key} className="card px-3 py-2">
                <div className="text-xs text-fg-2">{s.short}</div>
                <div className="text-lg font-bold">{summary.counts[s.key]}</div>
              </div>
            ))}
            <div className="card px-3 py-2">
              <div className="text-xs text-fg-2">Total</div>
              <div className="text-lg font-bold">{summary.total}</div>
            </div>
          </div>
          <p className="mt-3 text-base">
            In office: <b className="text-xl text-accent">{summary.inOfficePct === null ? '—' : `${summary.inOfficePct.toFixed(2)}%`}</b>
            <span className="block text-sm text-fg-2">Office days as a share of office and remote days.</span>
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between gap-2 border-b border-line pb-2 text-base font-bold">
            <span>{new Date(month.y, month.m, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <span className="flex gap-2">
              <button className="btn-outline min-h-10 w-10 px-0" onClick={() => shift(-1)} aria-label="Previous month">
                <BackIcon />
              </button>
              <button className="btn-outline min-h-10 w-10 px-0" onClick={() => shift(1)} aria-label="Next month">
                <ChevronRightIcon />
              </button>
            </span>
          </div>
          <ul className="divide-y divide-line">
            {monthDays.map((key) => {
              const status = byDay.get(key);
              const date = new Date(`${key}T00:00`);
              const weekend = date.getDay() === 0 || date.getDay() === 6;
              return (
                <li key={key} className="flex min-h-12 items-center gap-3 py-1">
                  <span className={`w-20 shrink-0 text-sm ${key === today ? 'font-bold text-accent' : weekend ? 'text-muted' : 'text-fg-2'}`}>
                    {date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </span>
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: status ? statusInfo(status).color : 'transparent' }} />
                  <select
                    className="input min-h-10 py-1"
                    value={status ?? ''}
                    onChange={(e) => void setWorkDay(key, (e.target.value || null) as WorkStatus | null)}
                    aria-label={`Status for ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`}
                  >
                    <option value="">—</option>
                    {WORK_STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}

function StatusPicker({ value, onPick }: { value: WorkStatus | undefined; onPick: (s: WorkStatus | null) => void }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
      {WORK_STATUSES.map((s) => {
        const on = value === s.key;
        return (
          <button
            key={s.key}
            aria-pressed={on}
            // tapping the chosen status again clears the day
            onClick={() => onPick(on ? null : s.key)}
            className={`btn min-h-12 border-2 text-sm ${on ? 'border-accent bg-accent/15 text-fg' : 'border-line-strong text-fg-2'}`}
          >
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: s.color }} />
            {s.short}
          </button>
        );
      })}
    </div>
  );
}

function BusTickets({ left }: { left: number }) {
  const [confirm, setConfirm] = useState(false);
  const low = left <= LOW_TICKETS;
  const trips = Math.max(0, Math.floor(left / TICKETS_PER_OFFICE_DAY));
  return (
    <section className={`card flex flex-col gap-3 border-2 p-4 ${low ? 'border-warn' : 'border-line'}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-bold">Bus tickets</h2>
        <span className="text-sm text-fg-2">
          {trips} office day{trips === 1 ? '' : 's'} left
        </span>
      </div>
      <p className="text-base">
        <b className="text-2xl">{Math.max(0, left)}</b> ticket{left === 1 ? '' : 's'} left
      </p>
      {low && (
        <p role="status" className="font-semibold text-warn">
          {left <= 0 ? 'Out of tickets: buy a new 10-pack.' : 'Last round trip: time to buy a new 10-pack.'}
        </p>
      )}
      {confirm ? (
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-outline" onClick={() => setConfirm(false)}>
            Not yet
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              void addBusPurchase();
              setConfirm(false);
            }}
          >
            Add {PACK_SIZE} tickets
          </button>
        </div>
      ) : (
        <button className="btn-outline" onClick={() => setConfirm(true)}>
          Bought a {PACK_SIZE}-pack
        </button>
      )}
    </section>
  );
}
