import { Link, useParams } from 'react-router-dom';
import { useWorkDays } from '../db/hooks';
import type { WorkStatus } from '../db/types';
import { dayKey } from '../lib/dates';
import { WORK_STATUSES, summarize } from '../lib/worklog';

// A year of the work log laid out for paper: the summary, then days down and
// months across. Rendered outside the app shell, in black on white, and sized
// for one landscape page (see the print rules in index.css).

const CODE: Record<WorkStatus, string> = { office: 'O', remote: 'R', off: '–', holiday: 'H', jury: 'J' };
const MONTHS = Array.from({ length: 12 }, (_, m) => new Date(2000, m, 1).toLocaleDateString(undefined, { month: 'short' }));

export function WorkLogPrint() {
  const year = Number(useParams().year) || new Date().getFullYear();
  const days = useWorkDays();
  if (!days) return null;

  const byDay = new Map(days.map((d) => [d.day, d.status]));
  const summary = summarize(days, year);

  return (
    <div className="min-h-full bg-white p-6 text-[13px] leading-tight text-black print:p-0">
      <div className="mb-4 flex items-center gap-3 print:hidden">
        <Link to="/work" className="rounded border border-gray-400 px-3 py-2">
          Back
        </Link>
        <button className="rounded bg-black px-4 py-2 font-semibold text-white" onClick={() => window.print()}>
          Print
        </button>
        <span className="text-gray-600">Choose "Save as PDF" in the print dialog to keep a copy.</span>
      </div>

      <h1 className="text-2xl font-bold">Work log {year}</h1>
      <table className="mt-3 border-collapse">
        <tbody>
          <tr>
            {WORK_STATUSES.map((s) => (
              <td key={s.key} className="border border-gray-400 px-3 py-1">
                {s.label}: <b>{summary.counts[s.key]}</b>
              </td>
            ))}
            <td className="border border-gray-400 px-3 py-1">
              Total: <b>{summary.total}</b>
            </td>
            <td className="border border-gray-400 px-3 py-1">
              In office: <b>{summary.inOfficePct === null ? '—' : `${summary.inOfficePct.toFixed(2)}%`}</b>
            </td>
          </tr>
        </tbody>
      </table>

      <table className="mt-4 w-full border-collapse text-center">
        <thead>
          <tr>
            <th className="w-8 border border-gray-400 py-0.5" />
            {MONTHS.map((m) => (
              <th key={m} className="border border-gray-400 py-0.5 font-semibold">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <tr key={d}>
              <th className="border border-gray-400 py-0.5 font-semibold">{d}</th>
              {MONTHS.map((_, m) => {
                const date = new Date(year, m, d);
                if (date.getMonth() !== m) return <td key={m} className="border border-gray-400 bg-gray-200" />;
                const status = byDay.get(dayKey(date));
                return (
                  <td key={m} className={`border border-gray-400 py-0.5 ${status === 'office' ? 'bg-gray-300 font-bold' : ''}`}>
                    {status ? CODE[status] : ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-gray-700">
        {WORK_STATUSES.map((s) => `${CODE[s.key]} ${s.label}`).join(' · ')}
      </p>
    </div>
  );
}
