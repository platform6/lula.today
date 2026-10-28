import { afterEach, describe, expect, it, vi } from 'vitest';
import { remember, remembered } from './stored';

describe('per-device storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads back what was remembered', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    expect(remembered('lula.test', 'a')).toBe('a');
    remember('lula.test', 'b');
    expect(remembered('lula.test', 'a')).toBe('b');
  });

  it('falls back, and ignores writes, when storage is blocked', () => {
    const blocked = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
    expect(remembered('lula.test', 'a')).toBe('a');
    expect(() => remember('lula.test', 'b')).not.toThrow();
  });
});
