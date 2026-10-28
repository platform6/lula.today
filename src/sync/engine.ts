import { useSyncExternalStore } from 'react';
import { CONFLICT_TARGET, SYNC_TABLES, db, dexieKey, getMeta, rowKey, setMeta, syncTable } from '../db/db';
import { setOnWrite } from '../db/mutate';
import type { OutboxEntry, SyncTable, TableRows } from '../db/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { backoffMs, isUnreachable, matchFor, planPush } from './plan';

// Offline-first sync:
//  push: flush the outbox. New rows are upserted whole; rows that only had some
//        columns changed update just those columns, so a device with an older
//        copy can't undo another device's changes (restart a stopped timer, or
//        bring back something deleted).
//  pull: fetch rows whose server-set updated_at is newer than the per-table cursor.
// Rows with unpushed local changes are never overwritten by a pull.
// A row the server refuses is set aside with its own back-off, so it doesn't hold
// up the rest; its changes stay queued until a push works or the person drops them.
// A sync that fails outright (server unreachable) backs off before trying again.

const PULL_OVERLAP_MS = 5_000; // re-read a small window to cover in-flight transactions
const PAGE_SIZE = 1000;
const PUSH_CHUNK = 500;
const PATCH_PARALLEL = 10;
const PUSH_DEBOUNCE_MS = 1_500;
const INTERVAL_MS = 60_000;
const LIVE_DEBOUNCE_MS = 400; // a burst of changes (a board move touches several rows) becomes one pull
const EPOCH = '1970-01-01T00:00:00Z';

/** A row whose queued changes the server keeps refusing. */
export interface StuckChange {
  table: SyncTable;
  key: string;
  error: string;
  attempts: number;
  /** When it will be tried again on its own (ms). */
  retryAt: number;
}

export interface SyncStatus {
  state: 'idle' | 'syncing' | 'offline' | 'error';
  lastSyncedAt: string | null;
  error: string | null;
  stuck: StuckChange[];
  /** After a failed sync, when it will try again on its own (ms). */
  retryAt: number | null;
}

let status: SyncStatus = { state: 'idle', lastSyncedAt: null, error: null, stuck: [], retryAt: null };
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

const stuck = new Map<string, StuckChange>();
const stuckId = (table: SyncTable, key: string) => `${table}:${key}`;
const publishStuck = () => setStatus({ stuck: [...stuck.values()] });

let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function retryAt(at: number) {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void syncNow(), Math.max(0, at - Date.now()));
}

let inFlight: Promise<void> | null = null;
let rerun = false;
let forced = false;

/**
 * Push then pull. Concurrent calls coalesce into at most one follow-up run.
 * `force` (a tap on Sync now, coming back online) skips any back-off and retries stuck rows.
 */
export function syncNow({ force = false } = {}): Promise<void> {
  if (force) forced = true;
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

  const force = forced;
  forced = false;
  if (force) failures = 0;

  setStatus({ state: 'syncing', error: null });
  try {
    await push(force);
    await pull();
    for (const hook of afterSyncHooks) await hook();
    await push(false); // anything the hooks created
    failures = 0;
    clearTimeout(retryTimer);
    const next = Math.min(...[...stuck.values()].map((s) => s.retryAt));
    if (stuck.size > 0) retryAt(next);
    setStatus({
      state: stuck.size > 0 ? 'error' : 'idle',
      lastSyncedAt: new Date().toISOString(),
      error: stuck.size > 0 ? `${stuck.size === 1 ? '1 change' : `${stuck.size} changes`} can't upload. See Settings › Sync.` : null,
      retryAt: null,
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
    // Timeouts and failed connections read as plain language; changes stay queued locally.
    const message = isUnreachable(raw)
      ? "Can't reach the sync server. Your changes are saved on this device and will upload when it's reachable."
      : raw;
    failures += 1;
    const at = Date.now() + backoffMs(failures);
    retryAt(at);
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: message, retryAt: at });
  }
}

/** Write, live-change and timer triggers wait out a failed sync's back-off; a retry is already scheduled. */
function syncAuto() {
  if (status.retryAt && Date.now() < status.retryAt) return;
  void syncNow();
}

/**
 * Give up on one row's queued changes and take the server's copy (or, if the
 * server never had it, remove it here). Only on the person's say-so.
 */
export async function dropChange(table: SyncTable, key: string) {
  const { data, error } = await supabase.from(table).select('*').match(matchFor(CONFLICT_TARGET[table], key)).maybeSingle();
  if (error) throw new Error(isUnreachable(error.message) ? "Can't reach the sync server. Try again when you're online." : error.message);
  await db.transaction('rw', [syncTable(table), db.outbox], async () => {
    await db.outbox.where('table').equals(table).filter((e) => e.key === key).delete();
    if (data) await syncTable(table).put(data as never);
    else await syncTable(table).delete(dexieKey(table, key) as never);
  });
  stuck.delete(stuckId(table, key));
  publishStuck();
  if (stuck.size === 0 && status.state === 'error' && !status.retryAt) setStatus({ state: 'idle', error: null });
}

async function push(force: boolean) {
  const queued = await db.outbox.orderBy('seq').toArray();
  // Stuck rows wait for their own retry time.
  const now = Date.now();
  const entries = queued.filter((e) => force || !((stuck.get(stuckId(e.table, e.key))?.retryAt ?? 0) > now));
  const failed = new Set<string>();
  /** The server refused this row: set it aside. An unreachable server fails the whole sync. */
  const refuse = (table: SyncTable, key: string, message: string) => {
    if (isUnreachable(message)) throw new Error(`Push ${table}: ${message}`);
    const id = stuckId(table, key);
    const attempts = (stuck.get(id)?.attempts ?? 0) + 1;
    stuck.set(id, { table, key, error: message, attempts, retryAt: Date.now() + backoffMs(attempts) });
    failed.add(id);
  };

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
          if (error) refuse(table, key, error.message);
          else if (count === 0) missing.push(key); // never reached the server: send it whole
        }),
      );
    }

    const rows = await local([...whole, ...missing]);
    const upsert = (batch: Record<string, unknown>[]) => supabase.from(table).upsert(batch as object[], { onConflict: CONFLICT_TARGET[table] });
    for (let i = 0; i < rows.length; i += PUSH_CHUNK) {
      const chunk = rows.slice(i, i + PUSH_CHUNK);
      const { error } = await upsert(chunk);
      if (!error) continue;
      if (isUnreachable(error.message)) throw new Error(`Push ${table}: ${error.message}`);
      // Something in the chunk was refused: send its rows one by one to find which.
      for (let j = 0; j < chunk.length; j += PATCH_PARALLEL) {
        await Promise.all(
          chunk.slice(j, j + PATCH_PARALLEL).map(async (row) => {
            const { error } = await upsert([row]);
            if (error) refuse(table, rowKey(table, row as never), error.message);
          }),
        );
      }
    }
  }

  // Only remove what was pushed; refused rows and writes made during the push keep their entries.
  const done = entries.filter((e) => !failed.has(stuckId(e.table, e.key)));
  await db.outbox.bulkDelete(done.map((e) => e.seq!));
  for (const e of done) stuck.delete(stuckId(e.table, e.key));
  // Forget rows whose queued changes are gone (dropped, or signed out).
  const left = new Set((await db.outbox.toArray()).map((e) => stuckId(e.table, e.key)));
  for (const id of stuck.keys()) if (!left.has(id)) stuck.delete(id);
  publishStuck();
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
  debounce = setTimeout(syncAuto, PUSH_DEBOUNCE_MS);
}

const onVisible = () => {
  if (document.visibilityState === 'visible') syncAuto();
};
const onOnline = () => void syncNow({ force: true });
const onOffline = () => setStatus({ state: 'offline' });

// Live updates: any change to a synced table (from another device, or Claude's
// board script) triggers a normal pull. The event's payload is not applied
// directly, so the updated_at cursor stays the one source of truth.
function pullSoon() {
  clearTimeout(liveDebounce);
  liveDebounce = setTimeout(syncAuto, LIVE_DEBOUNCE_MS);
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
    if (document.visibilityState === 'visible') syncAuto();
  }, INTERVAL_MS);
  void syncNow();
}

export function stopSync() {
  setOnWrite(() => {});
  clearTimeout(debounce);
  clearTimeout(liveDebounce);
  clearTimeout(retryTimer);
  if (live) void supabase.removeChannel(live);
  live = undefined;
  clearInterval(interval);
  document.removeEventListener('visibilitychange', onVisible);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
}
