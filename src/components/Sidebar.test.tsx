// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalData } from '../db/db';
import { setCurrentUser } from '../db/mutate';
import { RealmExpansionProvider } from './RealmExpansion';
import { Sidebar } from './Sidebar';

// The sidebar never reaches the server in these tests.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
  localStorage.clear();
});

afterEach(cleanup);

const Wrapper = ({ children }: { children: ReactNode }) => (
  <MemoryRouter>
    <RealmExpansionProvider>{children}</RealmExpansionProvider>
  </MemoryRouter>
);

describe('the hidden sidebar', () => {
  it('keeps every view, Realms and Settings as icon links', async () => {
    localStorage.setItem('lula.sidebar.hidden', 'yes');
    render(<Sidebar />, { wrapper: Wrapper });

    const views = await screen.findByRole('navigation', { name: 'Views' });
    const names = within(views).getAllByRole('link').map((a) => a.getAttribute('title'));
    expect(names).toEqual(['Time', 'Today', 'Calendar', 'Work log', 'Sorting', 'All tasks', 'Lists', 'Search', 'Archive']);
    expect(screen.getByRole('link', { name: 'Realms' }).getAttribute('href')).toBe('/realms');
    expect(screen.getByRole('link', { name: 'Settings' }).getAttribute('href')).toBe('/settings');
    expect(screen.getByRole('link', { name: 'Time' }).getAttribute('aria-current')).toBe('page');
  });

  it('opens back up to the full sidebar', async () => {
    const user = userEvent.setup();
    localStorage.setItem('lula.sidebar.hidden', 'yes');
    render(<Sidebar />, { wrapper: Wrapper });

    await user.click(screen.getByRole('button', { name: 'Show sidebar' }));
    expect(screen.queryByRole('button', { name: 'Show sidebar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Lists' })).toBeTruthy();
    expect(localStorage.getItem('lula.sidebar.hidden')).toContain('no');
  });
});
