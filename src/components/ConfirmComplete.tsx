import { createContext, useCallback, useContext, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { skipOccurrence } from '../db/actions';
import type { Task } from '../db/types';
import { describeLower, nextDue } from '../lib/recurrence';
import { CheckIcon, RepeatIcon } from './icons';
import { Sheet } from './Sheet';

// "Mark this complete?" confirmation, shared by every way a task can be
// completed (board drag, list checkbox, column picker). On by default; can be
// switched off per device in Settings.

const SETTING_KEY = 'lula.confirmComplete';
const settingListeners = new Set<() => void>();

function readSetting(): boolean {
  try {
    return localStorage.getItem(SETTING_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function useConfirmCompleteSetting(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(
    (l) => {
      settingListeners.add(l);
      return () => settingListeners.delete(l);
    },
    readSetting,
  );
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(SETTING_KEY, next ? 'on' : 'off');
    } catch {
      // per-device convenience only
    }
    settingListeners.forEach((l) => l());
  }, []);
  return [on, set];
}

/** Resolves true to complete. A recurring task can also be skipped here, which resolves false. */
type Confirm = (task: Task) => Promise<boolean>;

const ConfirmContext = createContext<Confirm>(async () => true);

/** Resolves true to go ahead with completing the task, false to leave it as is. */
export function useConfirmComplete(): Confirm {
  return useContext(ConfirmContext);
}

export function ConfirmCompleteProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Task | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((task) => {
    if (!readSetting()) return Promise.resolve(true);
    resolver.current?.(false); // a newer request replaces an unanswered one
    setPending(task);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const answer = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending !== null && (
        <Sheet title="Mark complete?" onClose={() => answer(false)} side="center">
          <div className="flex flex-col gap-4 p-4">
            <p className="text-lg font-bold break-words">{pending.title}</p>
            {pending.recurrence && <RepeatNote task={pending} />}
            <div className="grid grid-cols-2 gap-2">
              <button className="btn-outline" onClick={() => answer(false)}>
                Not yet
              </button>
              <button className="btn-primary" onClick={() => answer(true)} autoFocus>
                <CheckIcon width={22} height={22} strokeWidth={3} /> Complete
              </button>
            </div>
            {pending.recurrence && (
              <button
                className="btn-ghost min-h-11 text-sm underline underline-offset-3"
                onClick={() => {
                  void skipOccurrence(pending.id);
                  answer(false);
                }}
              >
                Skip this one, without completing it
              </button>
            )}
          </div>
        </Sheet>
      )}
    </ConfirmContext.Provider>
  );
}

function RepeatNote({ task }: { task: Task }) {
  const next = nextDue(task.recurrence!, task.due_at);
  return (
    <p className="flex gap-2.5 rounded-md bg-surface-2 px-3.5 py-3 text-sm text-fg-2">
      <RepeatIcon width={20} height={20} strokeWidth={2.5} className="mt-0.5 shrink-0 text-accent" />
      <span>
        Repeats {describeLower(task.recurrence!)}.{' '}
        {next ? (
          <>
            The next one is due{' '}
            <b className="text-fg">{next.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</b>.
          </>
        ) : (
          'This is the last one.'
        )}
      </span>
    </p>
  );
}
