import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => ({
  upload: vi.fn(async () => ({ error: null as { message: string } | null })),
  remove: vi.fn(async () => ({ error: null })),
}));
vi.mock('../lib/supabase', () => ({ supabase: { storage: { from: () => storage } } }));

import { db, clearLocalData, SYNC_TABLES } from './db';
import { setCurrentUser } from './mutate';
import { MAX_ATTACHMENT_BYTES, addAttachment, attachmentPath, deleteAttachment, formatSize } from './attachments';
import { createTask, deleteTask, ensureDefaults, getInbox } from './actions';

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
  storage.upload.mockClear();
  storage.remove.mockClear();
});

async function inboxTask() {
  await ensureDefaults();
  return createTask({ title: 'With files', project_id: (await getInbox())!.id });
}

describe('attachments', () => {
  it('keeps storage keys in the owner folder with a safe file name', () => {
    expect(attachmentPath('u', 'a', 'Bus ticket (May).pdf')).toBe('u/a/Bus_ticket_May_.pdf');
    expect(attachmentPath('u', 'a', '???')).toBe('u/a/file');
  });

  it('formats sizes', () => {
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });

  it('uploads the file, then records and queues its row', async () => {
    const task = await inboxTask();
    await addAttachment(task.id, new File(['hello'], 'note.txt', { type: 'text/plain' }));
    const [a] = await db.attachments.toArray();
    expect(a).toMatchObject({ task_id: task.id, name: 'note.txt', mime_type: 'text/plain', size: 5 });
    expect(a.path).toBe(`user-1/${a.id}/note.txt`);
    expect(storage.upload).toHaveBeenCalledWith(a.path, expect.any(File), expect.anything());
    expect(await db.outbox.toArray()).toContainEqual(expect.objectContaining({ table: 'attachments', key: a.id }));
    expect(SYNC_TABLES.indexOf('tasks')).toBeLessThan(SYNC_TABLES.indexOf('attachments'));
  });

  it('rejects files over 10 MB without uploading', async () => {
    const task = await inboxTask();
    const big = new File([new Uint8Array(MAX_ATTACHMENT_BYTES + 1)], 'big.bin');
    await expect(addAttachment(task.id, big)).rejects.toThrow('10 MB');
    expect(storage.upload).not.toHaveBeenCalled();
    expect(await db.attachments.count()).toBe(0);
  });

  it('records nothing when the upload fails', async () => {
    const task = await inboxTask();
    storage.upload.mockResolvedValueOnce({ error: { message: 'nope' } });
    await expect(addAttachment(task.id, new File(['x'], 'x.txt'))).rejects.toThrow('nope');
    expect(await db.attachments.count()).toBe(0);
  });

  it('removing one soft-deletes the row and deletes the stored file', async () => {
    const task = await inboxTask();
    await addAttachment(task.id, new File(['x'], 'x.txt'));
    const [a] = await db.attachments.toArray();
    await deleteAttachment(a);
    expect((await db.attachments.get(a.id))?.deleted_at).toBeTruthy();
    expect(storage.remove).toHaveBeenCalledWith([a.path]);
  });

  it('deleting the task deletes its attachments', async () => {
    const task = await inboxTask();
    await addAttachment(task.id, new File(['x'], 'x.txt'));
    await deleteTask(task.id);
    const [a] = await db.attachments.toArray();
    expect(a.deleted_at).toBeTruthy();
  });
});
