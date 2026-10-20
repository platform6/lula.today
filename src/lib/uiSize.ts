import { useCallback, useSyncExternalStore } from 'react';

// Per-device UI scale. It sets data-ui-size on <html>, which index.css maps to
// the root font size, so everything sized in rem (text, spacing, controls)
// scales together. index.html applies it before first paint.

export type UiSize = 'small' | 'medium' | 'large';
export const UI_SIZES: UiSize[] = ['small', 'medium', 'large'];

const KEY = 'lula.uiSize';
const listeners = new Set<() => void>();

function read(): UiSize {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'small' || v === 'large') return v;
  } catch {
    // storage unavailable: default size
  }
  return 'medium';
}

export function useUiSize(): [UiSize, (size: UiSize) => void] {
  const size = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
  const set = useCallback((next: UiSize) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // per-device convenience only
    }
    document.documentElement.dataset.uiSize = next;
    listeners.forEach((l) => l());
  }, []);
  return [size, set];
}
