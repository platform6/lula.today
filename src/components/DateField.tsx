import { dayLabel } from '../lib/dates';
import { CalendarIcon, ClockIcon, XIcon } from './icons';

// iOS draws <input type="date|time"> blank when empty (no placeholder) and in
// its own small centered style. This shows our own large, readable value or
// placeholder, with the native input stretched invisibly on top so a tap still
// opens the system picker.


function timeLabel(value: string): string {
  const [h, m] = value.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function DateField({
  kind = 'date',
  value,
  onChange,
  placeholder,
  label,
  className = '',
}: {
  kind?: 'date' | 'time';
  /** YYYY-MM-DD for dates, HH:MM for times, '' when empty. */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const Icon = kind === 'date' ? CalendarIcon : ClockIcon;
  const text = value ? (kind === 'date' ? dayLabel(value) : timeLabel(value)) : placeholder;

  return (
    <div className={`relative ${className}`}>
      <input
        type={kind}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Desktop browsers only open the picker from their small icon; open it on any click.
        onClick={(e) => {
          try {
            e.currentTarget.showPicker?.();
          } catch {
            // not allowed here; the native control still works
          }
        }}
        aria-label={label}
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
      />
      <div
        aria-hidden="true"
        className={`input flex items-center gap-2 pr-11 peer-focus-visible:border-accent peer-focus-visible:outline-3 peer-focus-visible:outline-accent ${value ? 'font-semibold text-fg' : 'text-muted'}`}
      >
        <Icon width={20} height={20} className="shrink-0" />
        <span className="truncate">{text}</span>
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={`Clear ${label.toLowerCase()}`}
          className="absolute top-1/2 right-1 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-sm text-fg-2 hover:bg-surface-2 hover:text-fg"
        >
          <XIcon width={20} height={20} />
        </button>
      )}
    </div>
  );
}
