import { useEffect, useRef, useState } from 'react';
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
        <GrowingText
          className="input resize-none overflow-hidden break-words"
          placeholder="Add a step…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onEnter={(el) => el.form?.requestSubmit()}
          enterKeyHint="done"
        />
      </form>
    </div>
  );
}

/** Fit a textarea's height to its text, so long text wraps instead of hiding past the edge. */
function fitHeight(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

/**
 * A one-line text box that wraps and grows to show all of its text. Steps are single
 * lines, so Enter calls onEnter instead of adding a line break, and pasted line breaks
 * become spaces.
 */
function GrowingText({
  onEnter,
  onChange,
  ...props
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> & { onEnter: (el: HTMLTextAreaElement) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Refit when the text changes from outside and when the box's width changes (sheet opening, rotation).
  useEffect(() => fitHeight(ref.current), [props.value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fitHeight(el);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      onChange={(e) => {
        if (/[\r\n]/.test(e.target.value)) e.target.value = e.target.value.replace(/\s*[\r\n]+\s*/g, ' ');
        fitHeight(e.target);
        onChange?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onEnter(e.currentTarget);
        }
      }}
    />
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
      <GrowingText
        className={`min-h-11 min-w-0 flex-1 resize-none overflow-hidden break-words bg-transparent py-2 font-medium leading-snug focus:outline-none ${step.is_done ? 'text-muted line-through' : 'text-fg'}`}
        defaultValue={step.text}
        aria-label="Step"
        onEnter={(el) => el.blur()}
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
