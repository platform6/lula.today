import { beforeEach, describe, expect, it } from 'vitest';
import { clearLocalData, db, SYNC_TABLES } from './db';
import { setCurrentUser } from './mutate';
import { ensureDefaults } from './actions';
import { deleteList, deleteListItem, saveList, saveListItem } from './lists';
import type { ListKind } from './types';

const entry = { title: 'A game', experienced_on: '2026-10-21', rating: 4, notes: 'Great ending', url: 'https://example.com', details: { platform: 'PC' } };

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
});

describe('experience lists', () => {
  it.each<[ListKind, Record<string, string>]>([
    ['general', {}],
    ['games', { platform: 'PC', playtime: '40' }],
    ['concerts', { artist: 'A band', venue: 'A venue', city: 'New York' }],
    ['television', { season: '1–3', episodes: '24', service: 'A network' }],
  ])('preserves %s details and supports entries without a date or rating', async (kind, details) => {
    const id = await saveList({ name: kind, kind, description: null });
    await saveListItem(id, { ...entry, experienced_on: null, rating: null, details });
    expect((await db.list_items.toArray())[0]).toMatchObject({ details, experienced_on: null, rating: null });
  });

  it('starts empty, including after task defaults are created', async () => {
    await ensureDefaults();
    expect(await db.lists.count()).toBe(0);
    expect(await db.list_items.count()).toBe(0);
  });

  it('queues offline lists and entries without creating tasks, and syncs parents first', async () => {
    const id = await saveList({ name: '  Finished games  ', kind: 'games', description: '' });
    await saveListItem(id, entry);
    const [item] = await db.list_items.toArray();
    expect(item).toMatchObject({ ...entry, list_id: id, user_id: 'user-1' });
    expect(await db.lists.get(id)).toMatchObject({ name: 'Finished games', description: null });
    expect(await db.tasks.count()).toBe(0);
    expect(await db.outbox.toArray()).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: 'lists', key: id }),
      expect.objectContaining({ table: 'list_items', key: item.id }),
    ]));
    expect(SYNC_TABLES.indexOf('lists')).toBeLessThan(SYNC_TABLES.indexOf('list_items'));
    db.close();
    await db.open();
    expect(await db.list_items.get(item.id)).toMatchObject(entry);
  });

  it('edits entries and list metadata while retaining the category and entry identity', async () => {
    const id = await saveList({ name: 'Games', kind: 'games', description: null });
    await saveListItem(id, entry);
    const [item] = await db.list_items.toArray();
    await saveListItem(id, { ...entry, notes: 'Updated notes', rating: null, details: { platform: 'Switch' } }, item.id);
    await saveList({ name: 'My games', kind: 'general', description: 'A collection' }, id);
    expect(await db.lists.get(id)).toMatchObject({ name: 'My games', kind: 'games' });
    expect(await db.list_items.get(item.id)).toMatchObject({ notes: 'Updated notes', rating: null, details: { platform: 'Switch' } });
    expect(await db.list_items.count()).toBe(1);
  });

  it('soft-deletes a list and its entries atomically, leaving other lists alone', async () => {
    const id = await saveList({ name: 'Games', kind: 'games', description: null });
    const other = await saveList({ name: 'More games', kind: 'games', description: null });
    await saveListItem(id, entry);
    await saveListItem(other, entry);
    await db.outbox.clear();
    await deleteList(id);
    expect((await db.lists.get(id))?.deleted_at).toBeTruthy();
    const items = await db.list_items.toArray();
    expect(items.find((i) => i.list_id === id)?.deleted_at).toBeTruthy();
    expect(items.find((i) => i.list_id === other)?.deleted_at).toBeNull();
    expect((await db.outbox.toArray()).map((e) => e.table).sort()).toEqual(['list_items', 'lists']);
    await expect(saveListItem(id, entry)).rejects.toThrow('no longer exists');
  });

  it('deletes an individual entry without deleting its list', async () => {
    const id = await saveList({ name: 'Games', kind: 'games', description: null });
    await saveListItem(id, entry);
    const [item] = await db.list_items.toArray();
    await deleteListItem(item.id);
    expect((await db.list_items.get(item.id))?.deleted_at).toBeTruthy();
    expect((await db.lists.get(id))?.deleted_at).toBeNull();
    await expect(saveListItem(id, entry, item.id)).rejects.toThrow('no longer exists');
  });

  it('rejects invalid input and cross-list edits without queuing writes', async () => {
    const id = await saveList({ name: 'Games', kind: 'games', description: null });
    const other = await saveList({ name: 'Other', kind: 'general', description: null });
    await saveListItem(id, entry);
    const [item] = await db.list_items.toArray();
    await db.outbox.clear();
    await expect(saveList({ name: ' ', kind: 'games', description: null })).rejects.toThrow();
    for (const invalid of [{ title: ' ' }, { rating: 6 }, { rating: 1.5 }, { experienced_on: '2026-02-30' }, { url: 'javascript:alert(1)' }]) {
      await expect(saveListItem(id, { ...entry, ...invalid })).rejects.toThrow();
    }
    await expect(saveListItem(other, entry, item.id)).rejects.toThrow();
    expect(await db.outbox.count()).toBe(0);
    expect(await db.list_items.get(item.id)).toMatchObject(entry);
  });
});
