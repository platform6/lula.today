import { useCallback, useSyncExternalStore } from 'react';
import { remember, remembered } from './stored';

// Per-device UI scale. It sets data-ui-size on <html>, which index.css maps to
// the root font size, so everything sized in rem (text, spacing, controls)
// scales together. index.html applies it before first paint.

export type UiSize = 'small' | 'medium' | 'large';
export const UI_SIZES: UiSize[] = ['small', 'medium', 'large'];

const KEY = 'lula.uiSize';
const listeners = new Set<() => void>();

function read(): UiSize {
  const v = remembered<string>(KEY, 'medium');
  return v === 'small' || v === 'large' ? v : 'medium';
}

export function useUiSize(): [UiSize, (size: UiSize) => void] {
  const size = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
  const set = useCallback((next: UiSize) => {
    remember(KEY, next);
    document.documentElement.dataset.uiSize = next;
    listeners.forEach((l) => l());
  }, []);
  return [size, set];
}
