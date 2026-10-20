import { CheckIcon } from './icons';

/**
 * Realm palette, hand-picked from balanced OKLCH sets: mostly "Jewel" tones
 * (L 0.64, C ≈ 0.135), one deeper blue (Indigo) and two quiet neutrals (Stone,
 * Slate). None sits near the brand orange, so no realm reads as the accent.
 * Ordered warm to cool, neutrals last, to fill the 4 × 3 grid.
 */
export const PALETTE = [
  { name: 'Honey', value: '#be7c09' },
  { name: 'Citron', value: '#a28c06' },
  { name: 'Olive', value: '#8f9318' },
  { name: 'Moss', value: '#799a32' },
  { name: 'Jade', value: '#42a360' },
  { name: 'Mint', value: '#05a38c' },
  { name: 'Indigo', value: '#6d69b8' },
  { name: 'Orchid', value: '#a573c9' },
  { name: 'Rose', value: '#bf69aa' },
  { name: 'Ruby', value: '#ce6583' },
  { name: 'Stone', value: '#968b78' },
  { name: 'Slate', value: '#7f8e9e' },
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
