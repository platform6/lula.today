import type { OutboxEntry } from '../db/types';

export interface PushPlan {
  /** Rows to upsert whole: new rows, or any row with a whole-row write queued. */
  whole: string[];
  /** Rows that only had columns changed, with the columns to update. */
  partial: Map<string, string[]>;
}

/** Sort one table's queued writes into whole-row upserts and column updates. */
export function planPush(entries: OutboxEntry[]): PushPlan {
  const whole = new Set<string>();
  const partial = new Map<string, Set<string>>();
  for (const e of entries) {
    if (whole.has(e.key)) continue;
    if (!e.fields) {
      whole.add(e.key);
      partial.delete(e.key);
      continue;
    }
    const fields = partial.get(e.key) ?? new Set<string>();
    for (const f of e.fields) fields.add(f);
    partial.set(e.key, fields);
  }
  return { whole: [...whole], partial: new Map([...partial].map(([k, f]) => [k, [...f]])) };
}
