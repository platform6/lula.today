import type { ReactNode } from 'react';
import { SyncBadge } from './SyncBadge';

/**
 * `actions` sit beside the title everywhere. `toolbar` sits beside it on wide
 * screens but drops to its own row on phones, so long titles aren't squeezed.
 */
export function PageHeader({
  title,
  actions,
  toolbar,
  back,
}: {
  title: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-bg">
      <div className="flex min-h-16 items-center gap-2 px-4 py-2">
        {back}
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
        {actions}
        {toolbar && <div className="hidden items-center gap-2 md:flex">{toolbar}</div>}
        <div className="md:hidden">
          <SyncBadge />
        </div>
      </div>
      {toolbar && <div className="flex items-center gap-2 px-4 pb-2 md:hidden">{toolbar}</div>}
    </header>
  );
}
