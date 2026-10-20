import type { ReactNode } from 'react';
import { SyncBadge } from './SyncBadge';

export function PageHeader({ title, actions, back }: { title: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
      {back}
      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
      {actions}
      <div className="md:hidden">
        <SyncBadge />
      </div>
    </header>
  );
}
