import { Link } from 'react-router-dom';
import type { Place } from '../lib/paths';
import { WitchHatIcon } from './icons';

/** Breadcrumb for where a task lives: Inbox · Home · Home › Kitchen reno. */
export function PlaceTag({ place, link = false }: { place: Place | undefined; link?: boolean }) {
  if (!place) return null;
  const body = (
    <>
      {place.kind === 'inbox' ? (
        <WitchHatIcon width={16} height={16} />
      ) : (
        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: place.color ?? 'var(--line-strong)' }} />
      )}
      {place.kind === 'project' && place.area ? (
        <span className="truncate">
          {place.area.name} <span className="text-muted">›</span> <span className="text-fg">{place.project!.name}</span>
        </span>
      ) : (
        <span className="truncate">{place.label}</span>
      )}
    </>
  );
  const cls = 'flex min-w-0 items-center gap-2 text-sm font-medium text-fg-2';
  return link ? (
    <Link to={place.href} className={`${cls} hover:text-fg`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
