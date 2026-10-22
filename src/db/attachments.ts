import { supabase } from '../lib/supabase';
import { currentUserId, newRow, now, patch, put } from './mutate';
import type { Attachment } from './types';

// Files attached to tasks. Uploading needs a connection (the file goes straight
// to the private storage bucket); the metadata row then syncs like any other.

const BUCKET = 'attachments';
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
/** Signed links last this long; the task sheet asks for fresh ones each time it opens. */
const LINK_SECONDS = 60 * 60;

/** Storage key: the owner's folder (storage policies check it), the row id, then a safe file name. */
export function attachmentPath(userId: string, id: string, name: string): string {
  const safe = name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '') || 'file';
  return `${userId}/${id}/${safe}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function addAttachment(taskId: string, file: File): Promise<void> {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name} is over the 10 MB limit.`);
  const row = newRow();
  const path = attachmentPath(currentUserId(), row.id, file.name);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(`Couldn't upload ${file.name}: ${error.message}`);
  await put('attachments', {
    ...row,
    task_id: taskId,
    name: file.name,
    mime_type: file.type || null,
    size: file.size,
    path,
  });
}

/** Remove from the task, then delete the stored file (left behind if that fails). */
export async function deleteAttachment(a: Attachment): Promise<void> {
  await patch('attachments', a.id, { deleted_at: now() });
  await supabase.storage.from(BUCKET).remove([a.path]);
}

/** Signed links to view each file, by path. Missing entries couldn't be signed. */
export async function attachmentLinks(paths: string[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (paths.length === 0) return links;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, LINK_SECONDS);
  if (error) throw new Error(error.message);
  for (const d of data ?? []) if (d.path && d.signedUrl) links.set(d.path, d.signedUrl);
  return links;
}
