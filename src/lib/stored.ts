// Per-device choices (a tab, a width) kept in localStorage. Storage can be blocked
// or empty, so every read has a fallback and a failed write is ignored.

export function remembered<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T | null) ?? fallback;
  } catch {
    return fallback;
  }
}

export function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // per-device convenience only
  }
}
