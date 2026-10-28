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

const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;

/** How long to wait before trying again after `failures` failures in a row: 5s, 10s, 20s … up to 5 minutes. */
export const backoffMs = (failures: number) => Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, failures - 1));

/** The server couldn't be reached (rather than refusing a change). */
export const isUnreachable = (message: string) => /abort|timeout|timed out|failed to fetch|networkerror|load failed/i.test(message);

/** The columns that find a row on the server, from its outbox key. */
export function matchFor(conflictTarget: string, key: string): Record<string, string> {
  const cols = conflictTarget.split(',');
  const values = cols.length > 1 ? key.split('|') : [key];
  return Object.fromEntries(cols.map((c, i) => [c, values[i]]));
}
