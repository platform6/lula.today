import { useState } from 'react';
import { useUnsortedEntries } from '../db/hooks';
import type { TimeEntry } from '../db/types';
import { DownIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { TimerBar } from '../components/Timer';
import { EntryRow, TimeReport, useUndoDelete } from '../components/TimeReport';
import { TimeEntrySheet } from '../components/TimeEntrySheet';
import { useTimeLookup } from '../components/useTimeLookup';

/** The home page: every tracked entry, as in Clockify's tracker. */
export function Time() {
  return (
    <div>
      <PageHeader title="Time" />
      <TimerBar variant="inline" />
      <UnsortedTime />
      <TimeReport groupBy="project" />
    </div>
  );
}

/** Finished time with no project, folded away until opened: tap an entry to give it one. */
function UnsortedTime() {
  const entries = useUnsortedEntries();
  const lookup = useTimeLookup();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const { remove, undoBar } = useUndoDelete(lookup);
  if (!entries || entries.length === 0 || !lookup.loaded) return null;

  return (
    <section className="mx-auto max-w-2xl px-4 pt-4">
      <button
        className="flex min-h-14 w-full items-center gap-3 rounded-md border-2 border-warn bg-warn/10 px-4 text-left"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex-1 text-base font-semibold">
          {entries.length} entr{entries.length === 1 ? 'y has' : 'ies have'} no project
        </span>
        <DownIcon className={`shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <p className="py-2 text-base text-fg-2">Tap an entry to pick its project.</p>
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <EntryRow key={e.id} entry={e} now={Date.now()} lookup={lookup} showDay onOpen={setEditing} onDelete={remove} />
            ))}
          </ul>
        </>
      )}
      {editing && <TimeEntrySheet entry={editing} onDelete={remove} onClose={() => setEditing(null)} />}
      {undoBar}
    </section>
  );
}
