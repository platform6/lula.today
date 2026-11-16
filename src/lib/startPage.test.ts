import { afterEach, describe, expect, it, vi } from 'vitest';
import { readStartPage, startRedirect } from './startPage';

const at = (pathname: string, search = '', hash = '') => ({ pathname, search, hash });

describe('opening page', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends a launch at / to the chosen page', () => {
    expect(startRedirect(at('/'), '/today')).toBe('/today');
    expect(startRedirect(at('/'), '/work')).toBe('/work');
  });

  it('stays on Time when Time is chosen', () => {
    expect(startRedirect(at('/'), '/')).toBeNull();
  });

  it('leaves other addresses alone', () => {
    expect(startRedirect(at('/inbox'), '/today')).toBeNull();
    expect(startRedirect(at('/projects/abc'), '/today')).toBeNull();
  });

  it('leaves sign-in and reset links alone', () => {
    expect(startRedirect(at('/', '?code=x'), '/today')).toBeNull();
    expect(startRedirect(at('/', '', '#access_token=x'), '/today')).toBeNull();
  });

  it('falls back to Time for a missing or unknown choice', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    expect(readStartPage()).toBe('/');
    store.set('lula.startPage', '/nowhere');
    expect(readStartPage()).toBe('/');
    store.set('lula.startPage', '/calendar');
    expect(readStartPage()).toBe('/calendar');
  });
});
