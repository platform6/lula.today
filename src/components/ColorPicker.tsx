import { CheckIcon } from './icons';

/**
 * Realm palette: 12 hues chosen to sit beside the orange accent on the
 * near-black ground (and stay legible as lines and fills in light mode).
 */
export const PALETTE = [
  { name: 'Ember', value: '#ff6a2b' },
  { name: 'Amber', value: '#f5b83d' },
  { name: 'Lemon', value: '#e6d450' },
  { name: 'Lime', value: '#9ed85a' },
  { name: 'Jade', value: '#3fcf8e' },
  { name: 'Teal', value: '#2ec4b6' },
  { name: 'Sky', value: '#4cc2ff' },
  { name: 'Cobalt', value: '#6b8cff' },
  { name: 'Purple', value: '#9d7bff' },
  { name: 'Orchid', value: '#d07cf0' },
  { name: 'Rose', value: '#ff6fa8' },
  { name: 'Coral', value: '#f2667a' },
] as const;

export const COLORS: string[] = PALETTE.map((c) => c.value);

export const colorName = (value: string | null) =>
  PALETTE.find((c) => c.value.toLowerCase() === value?.toLowerCase())?.name ?? 'Custom';

/** A 4 × 3 grid of large swatches; the current one carries a check mark. */
export function ColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="grid max-w-sm grid-cols-4 gap-2" role="radiogroup" aria-label="Color">
      {PALETTE.map((c) => {
        const selected = value?.toLowerCase() === c.value;
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.name}
            title={c.name}
            className={`grid h-12 place-items-center rounded-md border-[3px] ${selected ? 'border-fg' : 'border-transparent'}`}
            style={{ background: c.value }}
            onClick={() => onChange(c.value)}
          >
            {selected && <CheckIcon width={24} height={24} strokeWidth={3.5} className="text-[#111316]" />}
          </button>
        );
      })}
    </div>
  );
}
