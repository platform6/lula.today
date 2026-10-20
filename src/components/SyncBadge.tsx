import { usePendingCount } from '../db/hooks';
import { syncNow, useSyncStatus } from '../sync/engine';

export function SyncBadge() {
  const status = useSyncStatus();
  const pending = usePendingCount();

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
    <button
      className="flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-fg-2 hover:bg-surface-2"
      onClick={() => void syncNow()}
      title={status.error ?? 'Sync now'}
    >
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      {text}
    </button>
  );
}
