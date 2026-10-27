import { db, rowKey, syncTable } from './db';
import type { Row, SyncTable, TableRows } from './types';

// Every local write goes through here: the row and an outbox entry are written
// in one transaction, so nothing changes locally without being queued for sync.

let userId: string | null = null;
let onWrite: () => void = () => {};

export function setCurrentUser(id: string | null) {
  userId = id;
}

export function currentUserId(): string {
  if (!userId) throw new Error('Not signed in');
  return userId;
}

/** Called after each local write; the sync engine uses it to schedule a push. */
export function setOnWrite(fn: () => void) {
  onWrite = fn;
}

export const now = () => new Date().toISOString();

/** Base fields for a new row with a client-generated id. */
export function newRow(): Row {
  const t = now();
  return { id: crypto.randomUUID(), user_id: currentUserId(), created_at: t, updated_at: t, deleted_at: null };
}

const tables = () => [...db.tables.filter((t) => t.name !== 'meta')];

/** Run several writes atomically (they share one transaction). */
export async function writeTx(fn: () => Promise<void>): Promise<void> {
  await db.transaction('rw', tables(), fn);
  onWrite();
}

export async function put<T extends SyncTable>(table: T, row: TableRows[T]): Promise<void> {
  const stamped = { ...row, updated_at: now() };
  await writeTx(async () => {
    await syncTable(table).put(stamped);
    await db.outbox.add({ table, key: rowKey(table, stamped) });
  });
}

export async function putMany<T extends SyncTable>(table: T, rows: TableRows[T][]): Promise<void> {
  if (rows.length === 0) return;
  const t = now();
  const stamped = rows.map((r) => ({ ...r, updated_at: t }));
  await writeTx(async () => {
    await syncTable(table).bulkPut(stamped);
    await db.outbox.bulkAdd(stamped.map((r) => ({ table, key: rowKey(table, r) })));
  });
}

/** Merge changes into an existing row by primary key. No-op if missing. */
export async function patch<T extends SyncTable>(
  table: T,
  key: unknown,
  changes: Partial<TableRows[T]>,
): Promise<void> {
  await writeTx(async () => {
    const existing = await syncTable(table).get(key);
    if (!existing) return;
    const next = { ...existing, ...changes, updated_at: now() } as TableRows[T];
    await syncTable(table).put(next);
    // Only the changed columns are pushed, so an older copy of the row on this
    // device can't undo another device's changes to the rest of it.
    await db.outbox.add({ table, key: rowKey(table, next), fields: Object.keys(changes) });
  });
}
