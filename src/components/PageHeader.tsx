import type { ReactNode } from 'react';
import { SyncBadge } from './SyncBadge';

export function PageHeader({ title, actions, back }: { title: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-2 border-b border-line bg-bg px-4 py-2">
      {back}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
      {actions}
      <div className="md:hidden">
        <SyncBadge />
      </div>
    </header>
  );
}
