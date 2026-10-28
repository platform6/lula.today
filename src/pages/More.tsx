import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useInboxCount } from '../db/hooks';
import { ArchiveIcon, BriefcaseIcon, CalendarIcon, ChevronRightIcon, ListIcon, PencilIcon, SlidersIcon, WitchHatIcon } from '../components/icons';
import { CountBadge } from '../components/CountBadge';
import { PageHeader } from '../components/PageHeader';

/** On phones, everything that doesn't have its own tab. */
export function More() {
  const inboxCount = useInboxCount();
  return (
    <div>
      <PageHeader title="More" />
      <nav className="mx-auto flex max-w-2xl flex-col p-4">
        <ul className="divide-y divide-line rounded-md border border-line bg-surface">
          <Row to="/inbox" icon={<WitchHatIcon />} badge={<CountBadge count={inboxCount} />}>Sorting</Row>
          <Row to="/lists" icon={<PencilIcon />}>Lists</Row>
          <Row to="/calendar" icon={<CalendarIcon />}>Calendar</Row>
          <Row to="/work" icon={<BriefcaseIcon />}>Work log</Row>
          <Row to="/tasks" icon={<ListIcon />}>All tasks</Row>
          <Row to="/archive" icon={<ArchiveIcon />}>Archive</Row>
          <Row to="/settings" icon={<SlidersIcon />}>Settings</Row>
        </ul>
      </nav>
    </div>
  );
}

function Row({ to, icon, badge, children }: { to: string; icon: ReactNode; badge?: ReactNode; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 text-base font-semibold hover:bg-surface-2">
        <span className="shrink-0 text-fg-2">{icon}</span>
        <span className="flex-1">{children}</span>
        {badge}
        <ChevronRightIcon className="shrink-0 text-fg-2" />
      </Link>
    </li>
  );
}
