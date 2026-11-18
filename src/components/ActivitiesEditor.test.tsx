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
  it('merges two ticked activities into the one kept', async () => {
    const user = userEvent.setup();
    const typo = await ensureTimeTask('p1', 'Zelad');
    const right = await ensureTimeTask('p1', 'Zelda');
    await ensureTimeTask('p1', 'Mario');
    await ensureTimeTask('p2', 'Elsewhere');
    const a = await addEntry({ project_id: 'p1', time_task_id: typo.id, ...hour(9) });
    await addEntry({ project_id: 'p1', time_task_id: right.id, ...hour(11) });
    await addEntry({ project_id: 'p1', time_task_id: right.id, ...hour(13) });
    render(<ActivitiesEditor projectId="p1" name="Video games" />);

    // Only this project's activities, with their use.
    const row = (await screen.findByText('Zelad')).closest('li')!;
    expect(screen.queryByText('Elsewhere')).toBeNull();
    expect(within(row).getByText(/1 entry · 01:00:00/)).toBeTruthy();

    // One ticked: no Merge yet.
    await user.click(screen.getByRole('checkbox', { name: 'Select Zelad' }));
    expect(screen.queryByRole('button', { name: /^Merge/ })).toBeNull();
    await user.click(screen.getByRole('checkbox', { name: 'Select Zelda' }));
    await user.click(screen.getByRole('button', { name: 'Merge 2' }));

    // The most used is kept by default.
    const panel = screen.getByRole('group', { name: 'Merge activities' });
    expect((within(panel).getByRole('radio', { name: /Zelda/ }) as HTMLInputElement).checked).toBe(true);
    await user.click(within(panel).getByRole('button', { name: 'Merge' }));

    await waitFor(async () => expect((await db.time_entries.get(a.id))!.time_task_id).toBe(right.id));
    expect(await screen.findByText('Merged Zelad into Zelda: 1 entry moved.')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Select Zelad' })).toBeNull();
    expect(screen.getByText('Deleted activities (1)')).toBeTruthy();
  });

  it('renames from the pencil, and refuses another activity’s name', async () => {
    const user = userEvent.setup();
    const a = await ensureTimeTask('p1', 'Grinding');
    await ensureTimeTask('p1', 'Questing');
    render(<ActivitiesEditor projectId="p1" name="Video games" />);

    await user.click(await screen.findByRole('button', { name: 'Rename Grinding' }));
    const box = screen.getByRole('textbox', { name: 'Activity name' });
    await user.clear(box);
    await user.type(box, 'questing{Enter}');
    expect(await screen.findByText(/already called Questing/)).toBeTruthy();
    expect((await db.time_tasks.get(a.id))!.name).toBe('Grinding');

    await user.click(screen.getByRole('button', { name: 'Rename Grinding' }));
    await user.clear(screen.getByRole('textbox', { name: 'Activity name' }));
    await user.type(screen.getByRole('textbox', { name: 'Activity name' }), 'Farming{Enter}');
    await waitFor(async () => expect((await db.time_tasks.get(a.id))!.name).toBe('Farming'));
  });

  it('deletes with Undo', async () => {
    const user = userEvent.setup();
    const a = await ensureTimeTask('p1', 'Speedrun');
    render(<ActivitiesEditor projectId="p1" name="Video games" />);

    await user.click(await screen.findByRole('button', { name: 'Delete Speedrun' }));
    await waitFor(async () => expect((await db.time_tasks.get(a.id))!.archived_at).not.toBeNull());
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(async () => expect((await db.time_tasks.get(a.id))!.archived_at).toBeNull());
    expect(await screen.findByRole('button', { name: 'Delete Speedrun' })).toBeTruthy();
  });
});
