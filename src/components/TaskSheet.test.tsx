// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProject, createTask } from '../db/actions';
import { clearLocalData, db } from '../db/db';
import { setCurrentUser } from '../db/mutate';
import { TaskSheet } from './TaskSheet';

// The sheet never reaches the server in these tests.
vi.mock('../lib/supabase', () => ({ supabase: {} }));

beforeEach(async () => {
  await clearLocalData();
  setCurrentUser('user-1');
});

afterEach(cleanup);

async function openTask() {
  const project = await createProject({ name: 'Lula', area_id: null });
  const task = await createTask({ title: 'Fix it', project_id: project.id });
  const onClose = vi.fn();
  render(<TaskSheet id={task.id} onClose={onClose} />, { wrapper: MemoryRouter });
  await screen.findByLabelText('Title');
  return { task, onClose };
}

const stepTexts = async (taskId: string) =>
  (await db.steps.where('task_id').equals(taskId).toArray()).filter((s) => !s.deleted_at).map((s) => s.text);

describe('closing a task keeps what was typed', () => {
  it('adds a step still in the "Add a step" box when X is pressed', async () => {
    const user = userEvent.setup();
    const { task, onClose } = await openTask();

    await user.type(screen.getByPlaceholderText('Add a step…'), 'Write the test');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
    await waitFor(async () => expect(await stepTexts(task.id)).toEqual(['Write the Test']));
  });

  it('saves a title being typed when Escape closes the task', async () => {
    const user = userEvent.setup();
    const { task } = await openTask();

    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Fixed title');
    await user.keyboard('{Escape}');

    await waitFor(async () => expect((await db.tasks.get(task.id))!.title).toBe('Fixed Title'));
  });

  it('adds the step when leaving the box, once', async () => {
    const user = userEvent.setup();
    const { task } = await openTask();

    await user.type(screen.getByPlaceholderText('Add a step…'), 'First');
    await user.click(screen.getByLabelText('Title'));
    await user.click(screen.getByLabelText('Title'));

    await waitFor(async () => expect(await stepTexts(task.id)).toEqual(['First']));
  });
});
