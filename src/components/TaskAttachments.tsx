import { useEffect, useRef, useState } from 'react';
import { MAX_ATTACHMENT_BYTES, addAttachment, attachmentLinks, deleteAttachment, formatSize } from '../db/attachments';
import { useAttachments } from '../db/hooks';
import { PaperclipIcon, XIcon } from './icons';

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Files on the task. Attaching, opening and removing need a connection. */
export function Attachments({ taskId }: { taskId: string }) {
  const files = useAttachments(taskId) ?? [];
  const online = useOnline();
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const paths = files.map((f) => f.path).join('\n');
  useEffect(() => {
    if (!online || !paths) return;
    let live = true;
    attachmentLinks(paths.split('\n'))
      .then((l) => live && setLinks(l))
      .catch(() => live && setError("Couldn't load the files. Try reopening the task."));
    return () => {
      live = false;
    };
  }, [paths, online]);

  async function attach(list: FileList | null) {
    const chosen = [...(list ?? [])];
    if (picker.current) picker.current.value = '';
    if (chosen.length === 0) return;
    setError(null);
    const tooBig = chosen.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig.length) setError(`Over the 10 MB limit: ${tooBig.map((f) => f.name).join(', ')}`);
    const ok = chosen.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    setUploading((n) => n + ok.length);
    for (const f of ok) {
      try {
        await addAttachment(taskId, f);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  return (
    <div>
      <span className="field-label">Files</span>
      {files.length > 0 && (
        <ul className="mb-1.5 flex flex-col gap-1">
          {files.map((f) => {
            const url = links.get(f.path);
            const isImage = f.mime_type?.startsWith('image/');
            return (
              <li key={f.id} className="flex items-center gap-2 rounded-sm border-b border-line px-1 hover:bg-surface-2">
                {isImage && url ? (
                  <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-sm object-cover" />
                ) : (
                  <PaperclipIcon width={20} height={20} className="mx-2.5 shrink-0 text-fg-2" />
                )}
                {url ? (
                  <a
                    className="min-h-11 min-w-0 flex-1 truncate py-2.5 font-medium text-fg underline-offset-2 hover:underline"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {f.name}
                  </a>
                ) : (
                  <span className="min-h-11 min-w-0 flex-1 truncate py-2.5 font-medium text-fg-2">{f.name}</span>
                )}
                <span className="shrink-0 text-sm text-muted">{formatSize(f.size)}</span>
                <button
                  className="p-2 text-fg-2 hover:text-danger disabled:opacity-30"
                  disabled={!online}
                  onClick={() => void deleteAttachment(f)}
                  aria-label={`Remove ${f.name}`}
                >
                  <XIcon width={22} height={22} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <input ref={picker} type="file" multiple className="hidden" onChange={(e) => void attach(e.target.files)} />
      <button
        type="button"
        className="btn-outline flex min-h-11 items-center gap-1.5 px-3 text-sm disabled:opacity-50"
        disabled={!online || uploading > 0}
        onClick={() => picker.current?.click()}
      >
        <PaperclipIcon width={16} height={16} /> {uploading > 0 ? 'Uploading…' : 'Attach file'}
      </button>
      {!online && <p className="mt-1.5 text-sm text-muted">Files need a connection. You're offline.</p>}
      {error && <p role="alert" className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** Create a project from inside a task, and move the task into it. */
