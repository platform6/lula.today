import { useState } from 'react';
import { usePendingCount } from '../db/hooks';
import { syncNow, useSyncStatus } from '../sync/engine';
import { RefreshIcon } from './icons';

export function SyncBadge() {
  const status = useSyncStatus();
  const pending = usePendingCount();
  // A sync often finishes in a blink; spin a little longer after a tap so it reads as "done".
  const [tapped, setTapped] = useState(false);

  const [dot, text] =
    status.state === 'offline'
      ? ['bg-warn', pending ? `Offline · ${pending}` : 'Offline']
      : status.state === 'error'
        ? ['bg-danger', pending ? `Not synced · ${pending}` : 'Not synced']
        : status.state === 'syncing'
          ? ['bg-accent animate-pulse', 'Syncing']
          : pending
            ? ['bg-warn', `${pending} pending`]
            : ['bg-ok', 'Synced'];

  return (
    <span className="flex items-center gap-1">
      <button
        className="flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-fg-2 hover:bg-surface-2"
        onClick={() => {
          setTapped(true);
          setTimeout(() => setTapped(false), 700);
          void syncNow();
        }}
        title={status.error ?? 'Sync now'}
        aria-label={`${text}. Sync now`}
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
        {text}
        {/* shows the badge is a button; spins while a sync runs */}
        <RefreshIcon width={13} height={13} strokeWidth={2.5} className={`shrink-0 ${status.state === 'syncing' || tapped ? 'animate-spin' : ''}`} />
      </button>
      {/* the build's commit, matching the "Committed in …" notes on board cards */}
      <span
        className="font-mono text-[0.6875rem] text-muted"
        title={`Version ${__APP_VERSION__}, built ${new Date(__BUILD_TIME__).toLocaleString()}`}
      >
        {__APP_VERSION__}
      </span>
    </span>
  );
}
