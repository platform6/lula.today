import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/** The task detail sheet is driven by `?task=<id>` so any view can open it. */
export function useOpenTask() {
  const [, setParams] = useSearchParams();
  return useCallback(
    (id: string | null) =>
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('task', id);
        else next.delete('task');
        return next;
      }),
    [setParams],
  );
}
