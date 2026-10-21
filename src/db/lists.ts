import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { newRow, now, patch, put, putMany, writeTx } from './mutate';
import type { ExperienceList, ListItem } from './types';
import { LIST_KINDS } from '../lib/lists';

export function useLists() {
  return useLiveQuery(async () => (await db.lists.toArray()).filter((l) => !l.deleted_at).sort((a, b) => a.name.localeCompare(b.name)));
}

export function useListItems(listId: string) {
  return useLiveQuery(async () => (await db.list_items.where('list_id').equals(listId).toArray())
    .filter((i) => !i.deleted_at)
    .sort((a, b) => (b.experienced_on ?? '').localeCompare(a.experienced_on ?? '') || b.created_at.localeCompare(a.created_at)), [listId]);
}

type ListInput = Pick<ExperienceList, 'name' | 'kind' | 'description'>;
type ItemInput = Pick<ListItem, 'title' | 'experienced_on' | 'rating' | 'notes' | 'url' | 'details'>;

export async function saveList(input: ListInput, id?: string): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error('Give your list a name.');
  if (!LIST_KINDS.some((k) => k.value === input.kind)) throw new Error('Choose a list category.');
  const data = { ...input, name, description: input.description?.trim() || null };
  if (id) {
    const existing = await db.lists.get(id);
    if (!existing || existing.deleted_at) throw new Error('This list no longer exists.');
    // Keep the category stable so existing entries retain their fields.
    await patch('lists', id, { ...data, kind: existing.kind });
    return id;
  }
  const row: ExperienceList = { ...newRow(), ...data };
  await put('lists', row);
  return row.id;
}

export async function saveListItem(listId: string, input: ItemInput, id?: string): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Give your entry a title.');
  if (input.rating !== null && (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)) throw new Error('Choose a rating from 1 to 5.');
  if (input.experienced_on) {
    const date = new Date(`${input.experienced_on}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.experienced_on) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input.experienced_on) throw new Error('Choose a valid date.');
  }
  const url = input.url?.trim() || null;
  if (url) {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new Error('Use a complete http or https link.'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Use an http or https link.');
  }
  await writeTx(async () => {
    const list = await db.lists.get(listId);
    if (!list || list.deleted_at) throw new Error('This list no longer exists.');
    const data = { ...input, title, url, notes: input.notes?.trim() || null };
    if (id) {
      const existing = await db.list_items.get(id);
      if (!existing || existing.deleted_at || existing.list_id !== listId) throw new Error('This entry no longer exists.');
      await patch('list_items', id, data);
    } else {
      await put('list_items', { ...newRow(), ...data, list_id: listId });
    }
  });
}

export async function deleteList(id: string) {
  await writeTx(async () => {
    const deleted_at = now();
    const items = await db.list_items.where('list_id').equals(id).toArray();
    await putMany('list_items', items.filter((i) => !i.deleted_at).map((i) => ({ ...i, deleted_at })));
    await patch('lists', id, { deleted_at });
  });
}

export async function deleteListItem(id: string) {
  await patch('list_items', id, { deleted_at: now() });
}
