import { usePendingCount } from '../db/hooks';
import { syncNow, useSyncStatus } from '../sync/engine';

export function SyncBadge() {
  const status = useSyncStatus();
  const pending = usePendingCount();

  const [dot, text] =
    status.state === 'offline'
      ? ['bg-warn', pending ? `Offline · ${pending}` : 'Offline']
      : status.state === 'error'
        ? ['bg-danger', 'Sync error']
        : status.state === 'syncing'
          ? ['bg-accent animate-pulse', 'Syncing']
          : pending
            ? ['bg-warn', `${pending} pending`]
            : ['bg-ok', 'Synced'];

  return (
    <button
      className="flex min-h-10 items-center gap-2 rounded-sm px-2 text-xs font-semibold whitespace-nowrap text-fg-2 hover:bg-surface-2"
      onClick={() => void syncNow()}
      title={status.error ?? 'Sync now'}
    >
      <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} />
      {text}
    </button>
  );
}
