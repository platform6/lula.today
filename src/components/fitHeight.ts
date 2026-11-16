import { useEffect, type RefObject } from 'react';

/** Fit a textarea's height to its text, so long text shows in full instead of scrolling inside the box. */
export function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * Keep a textarea fitted to its text: now, whenever `value` changes from outside, and
 * when its width changes (sheet opening, phone rotation). Call fitHeight on input too.
 */
export function useFitHeight(ref: RefObject<HTMLTextAreaElement | null>, value?: unknown) {
  useEffect(() => fitHeight(ref.current), [ref, value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitHeight(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
}
