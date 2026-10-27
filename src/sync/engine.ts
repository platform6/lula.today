import { useSyncExternalStore } from 'react';
import { CONFLICT_TARGET, SYNC_TABLES, db, dexieKey, getMeta, rowKey, setMeta, syncTable } from '../db/db';
import { setOnWrite } from '../db/mutate';
import type { OutboxEntry, SyncTable, TableRows } from '../db/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { planPush } from './plan';

// Offline-first sync:
//  push: flush the outbox. New rows are upserted whole; rows that only had some
//        columns changed update just those columns, so a device with an older
//        copy can't undo another device's changes (restart a stopped timer, or
//        bring back something deleted).
//  pull: fetch rows whose server-set updated_at is newer than the per-table cursor.
// Rows with unpushed local changes are never overwritten by a pull.

const PULL_OVERLAP_MS = 5_000; // re-read a small window to cover in-flight transactions
const PAGE_SIZE = 1000;
const PUSH_CHUNK = 500;
const PATCH_PARALLEL = 10;
const PUSH_DEBOUNCE_MS = 1_500;
const INTERVAL_MS = 60_000;
const LIVE_DEBOUNCE_MS = 400; // a burst of changes (a board move touches several rows) becomes one pull
const EPOCH = '1970-01-01T00:00:00Z';

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  error: string | null;
}

let status: SyncStatus = { state: 'idle', lastSyncedAt: null, error: null };
const listeners = new Set<() => void>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

const afterSyncHooks: Array<() => Promise<void>> = [];

/** Run after every successful sync (used to bootstrap the Inbox and settings). */
export function onAfterSync(fn: () => Promise<void>) {
  afterSyncHooks.push(fn);
}

let inFlight: Promise<void> | null = null;
let rerun = false;

/** Push then pull. Concurrent calls coalesce into at most one follow-up run. */
export function syncNow(): Promise<void> {
  if (inFlight) {
    rerun = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        rerun = false;
        await runOnce();
      } while (rerun);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

async function runOnce() {
  if (!navigator.onLine) {
    setStatus({ state: 'offline' });
    return;
  }
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  setStatus({ state: 'syncing', error: null });
  try {
    await push();
    await pull();
    for (const hook of afterSyncHooks) await hook();
    await push(); // anything the hooks created
    setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString() });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    // Timeouts and failed connections read as plain language; changes stay queued locally.
    const unreachable = /abort|timeout|timed out|failed to fetch|networkerror|load failed/i.test(raw);
    const message = unreachable
      ? "Can't reach the sync server. Your changes are saved on this device and will upload when it's reachable."
      : raw;
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: message });
  }
}

async function push() {
  const entries = await db.outbox.orderBy('seq').toArray();
  if (entries.length === 0) return;

  for (const table of SYNC_TABLES) {
    const queued = entries.filter((e) => e.table === table);
    if (queued.length === 0) continue;
    const { whole, partial } = planPush(queued);
    const local = async (keys: string[]) =>
      (await syncTable(table).bulkGet(keys.map((k) => dexieKey(table, k)))).filter(Boolean) as unknown as Record<string, unknown>[];

    // Rows that only had some columns changed update just those columns.
    const missing: string[] = [];
    const changed = await local([...partial.keys()]);
    for (let i = 0; i < changed.length; i += PATCH_PARALLEL) {
      await Promise.all(
        changed.slice(i, i + PATCH_PARALLEL).map(async (row) => {
          const key = rowKey(table, row as never);
          const cols = Object.fromEntries(partial.get(key)!.map((f) => [f, row[f] ?? null]));
          const match = Object.fromEntries(CONFLICT_TARGET[table].split(',').map((c) => [c, row[c]]));
          const { error, count } = await supabase.from(table).update(cols, { count: 'exact' }).match(match);
          if (error) throw new Error(`Push ${table}: ${error.message}`);
          if (count === 0) missing.push(key); // never reached the server: send it whole
        }),
      );
    }

    const rows = await local([...whole, ...missing]);
    for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
      const { error } = await supabase
        .from(table)
        .upsert(rows.slice(i, i + PUSH_CHUNK) as object[], { onConflict: CONFLICT_TARGET[table] });
      if (error) throw new Error(`Push ${table}: ${error.message}`);
    }
  }

  // Only remove what was pushed; writes made during the push keep their entries.
  await db.outbox.bulkDelete(entries.map((e) => e.seq!));
}

async function pull() {
  for (const table of SYNC_TABLES) {
    const cursorKey = `cursor:${table}`;
    const cursor = (await getMeta<string>(cursorKey)) ?? EPOCH;
    const since = new Date(Math.max(0, Date.parse(cursor) - PULL_OVERLAP_MS)).toISOString();
    let maxSeen = cursor;

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .gt('updated_at', since)
        .order('updated_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Pull ${table}: ${error.message}`);
      const rows = (data ?? []) as TableRows[SyncTable][];
      if (rows.length > 0) {
        await applyPulled(table, rows);
        for (const r of rows) if (Date.parse(r.updated_at) > Date.parse(maxSeen)) maxSeen = r.updated_at;
      }
      if (rows.length < PAGE_SIZE) break;
    }

    if (maxSeen !== cursor) await setMeta(cursorKey, maxSeen);
  }
}

async function applyPulled(table: SyncTable, rows: TableRows[SyncTable][]) {
  await db.transaction('rw', [syncTable(table), db.outbox], async () => {
    const pending = new Set(
      (await db.outbox.where('table').equals(table).toArray()).map((e: OutboxEntry) => e.key),
    );
    const incoming = rows.filter((r) => !pending.has(rowKey(table, r)));
    await syncTable(table).bulkPut(incoming);
  });
}

let debounce: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let liveDebounce: ReturnType<typeof setTimeout> | undefined;
let live: RealtimeChannel | undefined;

function scheduleSoon() {
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), PUSH_DEBOUNCE_MS);
}

const onVisible = () => {
  if (document.visibilityState === 'visible') void syncNow();
};
const onOnline = () => void syncNow();
const onOffline = () => setStatus({ state: 'offline' });

// Live updates: any change to a synced table (from another device, or Claude's
// board script) triggers a normal pull. The event's payload is not applied
// directly, so the updated_at cursor stays the one source of truth.
function pullSoon() {
  clearTimeout(liveDebounce);
  liveDebounce = setTimeout(() => void syncNow(), LIVE_DEBOUNCE_MS);
}

/**
 * iOS has no Background Sync API, so sync runs on launch, on returning to the
 * foreground, on reconnect, shortly after local writes, on live change events,
 * and every minute while open (in case the live connection drops).
 */
export function startSync() {
  setOnWrite(scheduleSoon);
  live = supabase.channel('lula-sync').on('postgres_changes', { event: '*', schema: 'public' }, pullSoon).subscribe();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  interval = setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, INTERVAL_MS);
  void syncNow();
}

export function stopSync() {
  setOnWrite(() => {});
  clearTimeout(debounce);
  clearTimeout(liveDebounce);
  if (live) void supabase.removeChannel(live);
  live = undefined;
  clearInterval(interval);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
}
