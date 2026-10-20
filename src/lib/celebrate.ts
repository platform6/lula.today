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
