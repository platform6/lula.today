// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Sheet } from './Sheet';

/** A stand-in for the browser's visual viewport, which jsdom doesn't have. */
function fakeViewport(height: number, scale = 1) {
  const listeners = new Set<() => void>();
  const vv = {
    height,
    offsetTop: 0,
    scale,
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  };
  Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
  return {
    vv,
    resize(h: number) {
      vv.height = h;
      listeners.forEach((fn) => fn());
    },
  };
}

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
});

const inset = () => screen.getByRole('dialog').style.getPropertyValue('--kb');

describe('a sheet and the on-screen keyboard', () => {
  it('rides above the keyboard while it is open', () => {
    const viewport = fakeViewport(window.innerHeight);
    render(<Sheet title="Projects" onClose={() => {}}>List</Sheet>);
    expect(inset()).toBe('0px');

    act(() => viewport.resize(window.innerHeight - 300));
    expect(inset()).toBe('300px');

    act(() => viewport.resize(window.innerHeight));
    expect(inset()).toBe('0px');
  });

  it('ignores small changes and pinch zoom', () => {
    const viewport = fakeViewport(window.innerHeight - 40);
    render(<Sheet title="Projects" onClose={() => {}}>List</Sheet>);
    expect(inset()).toBe('0px');

    viewport.vv.scale = 2;
    act(() => viewport.resize(window.innerHeight / 2));
    expect(inset()).toBe('0px');
  });
});
