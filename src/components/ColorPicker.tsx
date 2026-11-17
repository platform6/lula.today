import { useMemo } from 'react';
import { useAreas } from '../db/hooks';
import { updateArea } from '../db/actions';
import type { Area } from '../db/types';
import { CheckIcon } from './icons';

/**
 * Realm palette, hand-picked from balanced OKLCH sets: mostly "Jewel" tones
 * (L 0.64, C ≈ 0.135, a little less for the blues and greens to stay in sRGB),
 * three deeper ones (Forest, Cobalt, Indigo, Plum at L ≈ 0.55) and three quiet
 * neutrals (Stone, Sage, Slate). The blues and teals sit opposite the warm
 * tones. None is near the brand orange, so no realm reads as the accent.
 * Ordered warm to cool, deep tones after their hue, neutrals last, to fill the 4 × 5 grid.
 */
export const PALETTE = [
  { name: 'Honey', value: '#be7c09' },
  { name: 'Citron', value: '#a28c06' },
  { name: 'Olive', value: '#8f9318' },
  { name: 'Moss', value: '#799a32' },
  { name: 'Jade', value: '#42a360' },
  { name: 'Forest', value: '#318454' },
  { name: 'Mint', value: '#05a38c' },
  { name: 'Teal', value: '#1ba09c' },
  { name: 'Lagoon', value: '#059eb1' },
  { name: 'Sky', value: '#2f99c0' },
  { name: 'Azure', value: '#3c8ccc' },
  { name: 'Cobalt', value: '#4970c6' },
  { name: 'Indigo', value: '#6d69b8' },
  { name: 'Orchid', value: '#a573c9' },
  { name: 'Plum', value: '#9e5598' },
  { name: 'Rose', value: '#bf69aa' },
  { name: 'Ruby', value: '#ce6583' },
  { name: 'Stone', value: '#968b78' },
  { name: 'Sage', value: '#789484' },
  { name: 'Slate', value: '#7f8e9e' },
] as const;

export const COLORS: string[] = PALETTE.map((c) => c.value);

export const colorName = (value: string | null) =>
  PALETTE.find((c) => c.value.toLowerCase() === value?.toLowerCase())?.name ?? 'Custom';

/** Which other realms use each color (lowercase hex → realm names), leaving out `realmId`. */
export function useRealmColorUse(realmId?: string): Map<string, string[]> {
  const areas = useAreas();
  return useMemo(() => {
    const used = new Map<string, string[]>();
    for (const a of areas ?? []) {
      if (a.id === realmId || !a.color) continue;
      const key = a.color.toLowerCase();
      used.set(key, [...(used.get(key) ?? []), a.name]);
    }
    return used;
  }, [areas, realmId]);
}

/**
 * A 4 × 5 grid of large swatches; the current one carries a check mark. Colors
 * other realms use (`usedBy`) carry a dot, and hovering names those realms.
 */
export function ColorPicker({
  value,
  onChange,
  usedBy,
}: {
  value: string | null;
  onChange: (c: string) => void;
  usedBy?: Map<string, string[]>;
}) {
  const anyUsed = PALETTE.some((c) => usedBy?.has(c.value));
  return (
    <div className="flex max-w-sm flex-col gap-2">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Color">
        {PALETTE.map((c) => {
          const selected = value?.toLowerCase() === c.value;
          const users = usedBy?.get(c.value);
          const label = users ? `${c.name}, used by ${users.join(', ')}` : c.name;
          return (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              className={`relative grid h-12 place-items-center rounded-md border-[3px] ${selected ? 'border-fg' : 'border-transparent'}`}
              style={{ background: c.value }}
              onClick={() => onChange(c.value)}
            >
              {selected && <CheckIcon width={24} height={24} strokeWidth={3.5} className="text-[#111316]" />}
              {users && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-[#111316] bg-white" aria-hidden />}
            </button>
          );
        })}
      </div>
      {anyUsed && (
        <p className="flex items-center gap-2 text-sm text-fg-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[#111316] bg-white" aria-hidden />
          Used by another realm. Hover to see which.
        </p>
      )}
    </div>
  );
}

/** A realm's color picker, marking the colors its other realms use. */
export function RealmColorPicker({ area }: { area: Area }) {
  const usedBy = useRealmColorUse(area.id);
  return <ColorPicker value={area.color} onChange={(color) => void updateArea(area.id, { color })} usedBy={usedBy} />;
}
