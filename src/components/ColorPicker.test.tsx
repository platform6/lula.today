// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createArea } from '../db/actions';
import { clearLocalData, db } from '../db/db';
import { setCurrentUser } from '../db/mutate';
import { COLORS, PALETTE, RealmColorPicker } from './ColorPicker';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
});

afterEach(cleanup);

describe('the realm color picker', () => {
  it('names the other realms using a color, and not the realm being edited', async () => {
    await createArea('Gaming', '#ce6583');
    await createArea('Reading', '#ce6583');
    const work = await createArea('Work', '#42a360');
    render(<RealmColorPicker area={(await db.areas.get(work.id))!} />);

    const ruby = await screen.findByRole('radio', { name: 'Ruby, used by Gaming, Reading' });
    expect(ruby.getAttribute('title')).toBe('Ruby, used by Gaming, Reading');
    // Its own color is checked, not marked as used.
    expect(screen.getByRole('radio', { name: 'Jade' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Slate' })).toBeTruthy();
    expect(screen.getByText(/Used by another realm/)).toBeTruthy();
  });

  it('offers 20 distinct colors', () => {
    expect(PALETTE).toHaveLength(20);
    expect(new Set(COLORS).size).toBe(20);
    expect(new Set(PALETTE.map((c) => c.name)).size).toBe(20);
  });
});
