import { useState, type ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { useProjects } from '../db/hooks';
import { tracksTime } from '../lib/paths';
import { ChevronRightIcon, ClockIcon, PlusIcon } from './icons';
import { Sheet } from './Sheet';
import { TimeEntrySheet } from './TimeEntrySheet';
import { TimerPicker } from './Timer';
import { useTimeLookup } from './useTimeLookup';

type Choice = 'menu' | 'timer' | 'time';

/**
 * What the + button opens: start a timer, add time, or add a task. On a project
 * or realm that tracks time, the timer and time start on it.
 */
export function AddMenu({ onClose, onNewTask }: { onClose: () => void; onNewTask: () => void }) {
  const [choice, setChoice] = useState<Choice>('menu');
  const lookup = useTimeLookup();
  const projectId = useMatch('/projects/:id')?.params.id;
  const realmId = useMatch('/realms/:id')?.params.id;
  // A realm's page is its own list.
  const project = (useProjects() ?? []).find((p) => (projectId ? p.id === projectId : realmId && p.is_area_default && p.area_id === realmId));
  const timeProject = project && tracksTime(project) ? project.id : undefined;

  if (choice === 'timer') return lookup.loaded ? <TimerPicker lookup={lookup} projectId={timeProject} onClose={onClose} /> : null;
  if (choice === 'time') return <TimeEntrySheet projectId={timeProject ?? null} onClose={onClose} />;

  return (
    <Sheet title="Add" onClose={onClose} side="center">
      <div className="flex flex-col gap-2 p-4">
        <Option icon={<ClockIcon width={24} height={24} />} label="Start timer" hint="Track time from now" onClick={() => setChoice('timer')} />
        <Option icon={<ClockIcon width={24} height={24} />} label="Add time" hint="Time already spent" onClick={() => setChoice('time')} />
        <Option icon={<PlusIcon width={24} height={24} />} label="New task" hint="Something to do" onClick={onNewTask} />
      </div>
    </Sheet>
  );
}

function Option({ icon, label, hint, onClick }: { icon: ReactNode; label: string; hint: string; onClick: () => void }) {
  return (
    <button className="flex min-h-16 w-full items-center gap-4 rounded-md border border-line bg-surface-2 px-4 text-left hover:bg-surface" onClick={onClick}>
      <span className="shrink-0 text-accent">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold">{label}</span>
        <span className="block text-sm text-fg-2">{hint}</span>
      </span>
      <ChevronRightIcon className="shrink-0 text-fg-2" />
    </button>
  );
}
