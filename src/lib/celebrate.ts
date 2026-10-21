// Tiny event bus so the data layer can announce a completion without knowing
// about the UI. Only local user actions emit; synced changes from other
// devices arrive through the sync engine and never pass through here.

type Listener = (taskId: string) => void;

const listeners = new Set<Listener>();

export function onTaskCompleted(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitTaskCompleted(taskId: string) {
  listeners.forEach((fn) => fn(taskId));
}

// Short status messages from the data layer (e.g. "Done · next one Wed, Oct 28"),
// shown as the app's toast.
type NoticeListener = (text: string) => void;

const noticeListeners = new Set<NoticeListener>();

export function onNotice(fn: NoticeListener): () => void {
  noticeListeners.add(fn);
  return () => noticeListeners.delete(fn);
}

export function emitNotice(text: string) {
  noticeListeners.forEach((fn) => fn(text));
}
