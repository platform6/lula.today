import type { TimeEntry, TimeField } from '../db/types';
import { fieldApplies, fieldSuggestions } from '../lib/timePicks';

/**
 * The extra fields an entry shows: those for its project's realm (or for every realm),
 * plus any it already has a value in, so moving or archiving never hides saved values.
 */
export function shownFields(all: TimeField[], realmId: string | null, saved: Record<string, string> = {}): TimeField[] {
  return all.filter((f) => fieldApplies(f, realmId) || !!saved[f.id]);
}

/** Only the values of the fields shown, trimmed, without blanks. */
export function keptValues(values: Record<string, string>, fields: TimeField[]): Record<string, string> {
  const ids = new Set(fields.map((f) => f.id));
  return Object.fromEntries(
    Object.entries(values)
      .map(([k, v]) => [k, v.trim()])
      .filter(([k, v]) => v && ids.has(k)),
  );
}

/** One row per field, for a Group. Typed fields suggest values used before. */
export function TimeFieldRows({
  fields,
  values,
  onChange,
  entries,
}: {
  fields: TimeField[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  entries: TimeEntry[];
}) {
  return (
    <>
      {fields.map((f) => {
        const id = `time-field-${f.id}`;
        return (
          <div key={f.id} className="flex min-h-14 items-center gap-3 px-4 py-1 focus-within:bg-surface">
            <label className="shrink-0 text-base" htmlFor={id}>{f.name}</label>
            <div className="flex min-w-0 flex-1 justify-end">
              {f.kind === 'choice' ? (
                <select id={id} className="input w-auto min-w-0 text-right" value={values[f.id] ?? ''} onChange={(e) => onChange(f.id, e.target.value)}>
                  <option value="">None</option>
                  {[...new Set([...f.choices, ...(values[f.id] ? [values[f.id]] : [])])].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    id={id}
                    list={`${id}-used`}
                    autoComplete="off"
                    className="min-h-12 min-w-0 flex-1 bg-transparent text-right text-base outline-none placeholder:text-muted"
                    placeholder={`Add ${f.name.toLowerCase()}`}
                    value={values[f.id] ?? ''}
                    onChange={(e) => onChange(f.id, e.target.value)}
                  />
                  <datalist id={`${id}-used`}>
                    {fieldSuggestions(entries, f.id).map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
