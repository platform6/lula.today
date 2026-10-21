import { useAreas, useProjects } from '../db/hooks';
import { byPosition } from '../lib/position';

/**
 * A select grouped by realm: Inbox, then for each realm its own task list
 * followed by its active projects.
 */
export function ProjectSelect({
  value,
  onChange,
  allLabel,
  includeInbox = true,
  className = 'input',
  ariaLabel = 'Project',
}: {
  value: string;
  onChange: (projectId: string) => void;
  /** When set, adds an "all" option with an empty value (for filters). */
  allLabel?: string;
  includeInbox?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const areas = useAreas() ?? [];
  const projects = (useProjects() ?? []).filter((p) => !p.archived_at || p.id === value);
  const inbox = projects.find((p) => p.is_inbox);
  const orphans = projects.filter((p) => !p.is_inbox && !p.is_area_default && !areas.some((a) => a.id === p.area_id));

  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
      {allLabel && <option value="">{allLabel}</option>}
      {includeInbox && inbox && <option value={inbox.id}>Sorting</option>}
      {areas.map((area) => {
        const own = projects.find((p) => p.is_area_default && p.area_id === area.id);
        const list = projects.filter((p) => p.area_id === area.id && !p.is_area_default).sort(byPosition);
        return (
          <optgroup key={area.id} label={area.name}>
            {own && <option value={own.id}>{area.name} (realm tasks)</option>}
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {area.name} › {p.name}
              </option>
            ))}
          </optgroup>
        );
      })}
      {orphans.length > 0 && (
        <optgroup label="Needs a realm">
          {orphans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </optgroup>
      )}
    </select>
  );
}
