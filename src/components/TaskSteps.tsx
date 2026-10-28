import { useState } from 'react';
import { addStep, deleteStep, moveStep, updateStep } from '../db/actions';
import { useSteps } from '../db/hooks';
import type { Step } from '../db/types';
import { DownIcon, UpIcon, XIcon } from './icons';

export function Steps({ taskId }: { taskId: string }) {
  const steps = useSteps(taskId) ?? [];
  const [text, setText] = useState('');
  const done = steps.filter((s) => s.is_done).length;

  return (
    <div>
      <label className="field-label">
        Steps {steps.length > 0 && <span className="normal-case">· {done}/{steps.length}</span>}
      </label>
      <ul className="flex flex-col gap-1">
        {steps.map((s, i) => (
          <StepRow key={s.id} step={s} first={i === 0} last={i === steps.length - 1} />
        ))}
      </ul>
      <form
        className="mt-1"
        onSubmit={(e) => {
          e.preventDefault();
          const v = text.trim();
          if (!v) return;
          void addStep(taskId, v);
          setText('');
        }}
      >
        <input
          className="input"
          placeholder="Add a step…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          enterKeyHint="done"
        />
      </form>
    </div>
  );
}

function StepRow({ step, first, last }: { step: Step; first: boolean; last: boolean }) {
  return (
    <li className="group flex items-center gap-2 rounded-sm border-b border-line px-1 hover:bg-surface-2">
      <input
        type="checkbox"
        className="h-6 w-6 shrink-0 accent-[var(--accent)]"
        checked={step.is_done}
        onChange={(e) => void updateStep(step.id, { is_done: e.target.checked })}
      />
      <input
        className={`min-h-11 min-w-0 flex-1 bg-transparent py-2 font-medium focus:outline-none ${step.is_done ? 'text-muted line-through' : 'text-fg'}`}
        defaultValue={step.text}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== step.text) void updateStep(step.id, { text: v });
        }}
      />
      <button className="p-2 text-fg-2 disabled:opacity-30" disabled={first} onClick={() => void moveStep(step.task_id, step.id, -1)} aria-label="Move up">
        <UpIcon width={22} height={22} />
      </button>
      <button className="p-2 text-fg-2 disabled:opacity-30" disabled={last} onClick={() => void moveStep(step.task_id, step.id, 1)} aria-label="Move down">
        <DownIcon width={22} height={22} />
      </button>
      <button className="p-2 text-fg-2 hover:text-danger" onClick={() => void deleteStep(step.id)} aria-label="Delete step">
        <XIcon width={22} height={22} />
      </button>
    </li>
  );
}
