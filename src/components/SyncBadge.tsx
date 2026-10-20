import { usePendingCount } from '../db/hooks';
import { syncNow, useSyncStatus } from '../sync/engine';

export function SyncBadge() {
  const status = useSyncStatus();
  const pending = usePendingCount();

  const [dot, text] =
    status.state === 'offline'
      ? ['bg-amber-400', pending ? `Offline · ${pending} pending` : 'Offline']
      : status.state === 'error'
        ? ['bg-danger', 'Sync error']
        : status.state === 'syncing'
          ? ['bg-accent animate-pulse', 'Syncing']
          : pending
            ? ['bg-amber-400', `${pending} pending`]
            : ['bg-emerald-400', 'Synced'];

  return (
    <button
      className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted hover:bg-surface-2"
      onClick={() => void syncNow()}
      title={status.error ?? 'Sync now'}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {text}
    </button>
  );
}
