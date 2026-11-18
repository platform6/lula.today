// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearLocalData, db } from '../db/db';
import { setCurrentUser } from '../db/mutate';
import { addEntry, ensureTimeTask } from '../db/time';
import { ActivitiesEditor } from './ActivitiesEditor';

vi.mock('../lib/supabase', () => ({ supabase: {} }));

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
});

afterEach(cleanup);

const hour = (h: number) => ({ started_at: new Date(2026, 0, 5, h).toISOString(), ended_at: new Date(2026, 0, 5, h + 1).toISOString() });

describe('the activities editor', () => {
  it('merges a misspelt activity into the right one', async () => {
    const user = userEvent.setup();
    const typo = await ensureTimeTask('p1', 'Zelad');
    const right = await ensureTimeTask('p1', 'Zelda');
    await ensureTimeTask('p2', 'Elsewhere');
    const e = await addEntry({ project_id: 'p1', time_task_id: typo.id, ...hour(9) });
    render(<ActivitiesEditor projectId="p1" name="Video games" />);

    // Only this project's activities, with their use.
    expect(await screen.findByDisplayValue('Zelad')).toBeTruthy();
    expect(screen.queryByDisplayValue('Elsewhere')).toBeNull();
    const row = screen.getByDisplayValue('Zelad').closest('li')!;
    expect(within(row).getByText(/1 entry · 01:00:00/)).toBeTruthy();

    await user.selectOptions(within(row).getByRole('combobox'), right.id);
    await user.click(within(row).getByRole('button', { name: 'Merge' }));

    await waitFor(async () => expect((await db.time_entries.get(e.id))!.time_task_id).toBe(right.id));
    expect(await screen.findByText('Merged Zelad into Zelda: 1 entry moved.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByDisplayValue('Zelad')).toBeNull());
    expect(screen.getByText('Removed activities (1)')).toBeTruthy();
  });

  it("won't rename an activity to another's name, and points to Merge", async () => {
    const user = userEvent.setup();
    const a = await ensureTimeTask('p1', 'Grinding');
    await ensureTimeTask('p1', 'Questing');
    render(<ActivitiesEditor projectId="p1" name="Video games" />);

    const box = await screen.findByDisplayValue('Grinding');
    await user.clear(box);
    await user.type(box, 'questing{Enter}');

    expect(await screen.findByText(/already called Questing/)).toBeTruthy();
    expect((box as HTMLInputElement).value).toBe('Grinding');
    expect((await db.time_tasks.get(a.id))!.name).toBe('Grinding');
  });
});
