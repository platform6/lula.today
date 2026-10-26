import { setProjectShows } from '../db/actions';
import type { Project } from '../db/types';
import { showsBoard, tracksTime } from '../lib/paths';

/** Tick boxes for what a project (or a realm's own list) shows: its kanban board, time tracking, or both. */
export function ShowsEditor({ project, name }: { project: Project; name: string }) {
  const board = showsBoard(project);
  const time = tracksTime(project);
  const box = (label: string, hint: string, checked: boolean, onChange: (on: boolean) => void) => (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border-2 border-line-strong p-3 has-[:checked]:border-accent">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
        checked={checked}
        // the last one ticked stays ticked
        disabled={checked && !(board && time)}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="block text-base font-semibold">{label}</span>
        <span className="block text-sm text-fg-2">{hint}</span>
      </span>
    </label>
  );

  return (
    <section className="flex flex-col gap-2">
      <h2 className="section-title">Shows</h2>
      {box('Kanban board', `Tasks for ${name} in columns.`, board, (on) => void setProjectShows(project.id, { show_board: on }))}
      {box(
        'Time tracking',
        `Pick ${name} in the timer and see its time report.`,
        time,
        (on) => void setProjectShows(project.id, { track_time: on }),
      )}
      {board && time && <p className="text-sm text-fg-2">With both ticked, its page switches between Board and Time.</p>}
    </section>
  );
}
