// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalData, db } from '../db/db';
import { setCurrentUser } from '../db/mutate';
import { addEntry, runningEntries } from '../db/time';
import { dayKey } from '../lib/dates';
import { rangeDays } from '../lib/time';
import { TimeEntrySheet } from './TimeEntrySheet';
import { TimeReport } from './TimeReport';
import { TimerBar } from './Timer';

// The screens never reach the server in these tests.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

beforeAll(() => {
  // jsdom has no pointer capture; the swipe and resize handlers call it.
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const live = async () => (await db.time_entries.toArray()).filter((e) => !e.deleted_at);

/** A finished entry today (local time), `hours` long, ending an hour ago. */
async function finished(description: string, hours = 1) {
  const end = new Date(Date.now() - 3600_000);
  const start = new Date(end.getTime() - hours * 3600_000);
  return addEntry({ started_at: start.toISOString(), ended_at: end.toISOString(), description });
}

describe('the timer', () => {
  it('starts, switches and stops', async () => {
    const user = userEvent.setup();
    render(<TimerBar variant="side" />, { wrapper: MemoryRouter });

    await user.click(await screen.findByRole('button', { name: /start timer/i }));
    await user.type(screen.getByPlaceholderText('What are you working on?'), 'Write tests');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('Write tests')).toBeTruthy();
    expect(screen.getByRole('timer')).toBeTruthy();
    const [first] = await runningEntries();

    await user.click(screen.getByRole('button', { name: 'Switch' }));
    await user.type(screen.getByPlaceholderText('What are you working on?'), 'Review');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('Review')).toBeTruthy();
    const running = await runningEntries();
    expect(running.map((e) => e.description)).toEqual(['Review']);
    expect((await db.time_entries.get(first.id))!.ended_at).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByRole('button', { name: /start timer/i })).toBeTruthy();
    expect(await runningEntries()).toHaveLength(0);
  });

  it('starts a recent entry again in one tap', async () => {
    const user = userEvent.setup();
    await finished('Laps');
    render(<TimerBar variant="side" />, { wrapper: MemoryRouter });

    await user.click(await screen.findByRole('button', { name: /start timer/i }));
    const recent = screen.getByRole('heading', { name: 'Start again' }).parentElement!;
    await user.click(await within(recent).findByText('Laps'));

    await waitFor(async () => expect((await runningEntries()).map((e) => e.description)).toEqual(['Laps']));
    expect(await live()).toHaveLength(2);
  });
});

describe('editing an entry', () => {
  it("won't save times that end in the future", async () => {
    // Noon, so the times below stay on one day in any zone the test runs in.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 28, 12, 0));
    const user = userEvent.setup();
    const entry = await addEntry({
      started_at: new Date(2026, 9, 28, 9, 0).toISOString(),
      ended_at: new Date(2026, 9, 28, 10, 0).toISOString(),
      description: 'Standup',
    });
    const onClose = vi.fn();
    render(<TimeEntrySheet entry={entry} onClose={onClose} />);

    fireEvent.change(await screen.findByLabelText('End'), { target: { value: '13:00' } });
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText("The end can't be in the future.")).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect((await db.time_entries.get(entry.id))!.ended_at).toBe(entry.ended_at);
  });

  it('asks before throwing away changes', async () => {
    const user = userEvent.setup();
    const entry = await finished('Standup');
    const onClose = vi.fn();
    render(<TimeEntrySheet entry={entry} onClose={onClose} />);

    const description = await screen.findByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Planning');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByText('Discard your changes?')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(onClose).not.toHaveBeenCalled();
    expect((screen.getByLabelText('Description') as HTMLInputElement).value).toBe('Planning');

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onClose).toHaveBeenCalled();
    expect((await db.time_entries.get(entry.id))!.description).toBe('Standup');
  });
});

describe('the report', () => {
  it('waits for a whole custom date before redrawing', async () => {
    localStorage.setItem('lula.time.view', 'report');
    localStorage.setItem('lula.time.period', 'custom');
    await finished('Reading');
    render(<TimeReport groupBy="auto" />, { wrapper: MemoryRouter });

    const from = (await screen.findByLabelText('From')) as HTMLInputElement;
    const bars = () => screen.getAllByRole('button', { name: /: \d\d:\d\d:\d\d$/ }).length;
    const heading = () => screen.getByRole('heading', { level: 2 }).textContent;
    const before = { bars: bars(), heading: heading() };

    // A year typed a digit at a time passes through 0002, 0020 and 0202.
    for (const year of ['0002', '0020', '0202']) {
      fireEvent.change(from, { target: { value: `${year}-10-01` } });
      expect(from.value).toBe(`${year}-10-01`);
      expect(heading()).toBe(before.heading);
      expect(bars()).toBe(before.bars);
    }

    const today = new Date();
    const firstOfMonth = dayKey(new Date(today.getFullYear(), today.getMonth(), 1));
    fireEvent.change(from, { target: { value: firstOfMonth } });
    await waitFor(() => expect(heading()).not.toBe(before.heading));
    const to = (screen.getByLabelText('To') as HTMLInputElement).value;
    expect(bars()).toBe(rangeDays({ kind: 'custom', from: firstOfMonth, to }).length);

    // Leaving a half-typed date puts back the last whole one.
    fireEvent.change(from, { target: { value: '0002-10-01' } });
    fireEvent.blur(from);
    expect(from.value).toBe(firstOfMonth);
  });
});

describe('the entries list', () => {
  it('deletes an entry with a swipe, and Undo brings it back', async () => {
    const user = userEvent.setup();
    const entry = await finished('Email');
    render(<TimeReport groupBy="auto" />, { wrapper: MemoryRouter });

    const card = (await screen.findByText('Email')).closest('li')!.firstElementChild as HTMLElement;
    const touch = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(card, { ...touch, clientX: 300, clientY: 100 });
    fireEvent.pointerMove(card, { ...touch, clientX: 280, clientY: 100 });
    fireEvent.pointerMove(card, { ...touch, clientX: 150, clientY: 102 });
    fireEvent.pointerUp(card, touch);

    await waitFor(async () => expect((await db.time_entries.get(entry.id))!.deleted_at).not.toBeNull());
    const undo = await screen.findByRole('status');
    expect(undo.textContent).toMatch(/Deleted/);

    await act(() => user.click(within(undo).getByRole('button', { name: 'Undo' })));
    await waitFor(async () => expect((await db.time_entries.get(entry.id))!.deleted_at).toBeNull());
    expect(await screen.findByText('Email')).toBeTruthy();
  });
});
