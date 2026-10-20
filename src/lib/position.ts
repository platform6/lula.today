import { generateKeyBetween } from 'fractional-indexing';

export interface Positioned {
  id?: string;
  position: string;
}

export function byPosition<T extends Positioned>(a: T, b: T): number {
  if (a.position < b.position) return -1;
  if (a.position > b.position) return 1;
  // Two devices can generate the same key offline; ids break the tie.
  return (a.id ?? '') < (b.id ?? '') ? -1 : (a.id ?? '') > (b.id ?? '') ? 1 : 0;
}

/** A key strictly between two neighbours (either may be null for an open end). */
export function keyBetween(before: string | null | undefined, after: string | null | undefined): string {
  const a = before ?? null;
  const b = after ?? null;
  if (a !== null && b !== null && a >= b) {
    // Colliding keys from concurrent offline edits: fall back to just after `a`.
    return generateKeyBetween(a, null);
  }
  return generateKeyBetween(a, b);
}

export function keyAtEnd(sorted: Positioned[]): string {
  return keyBetween(sorted.at(-1)?.position, null);
}

export function keyAtStart(sorted: Positioned[]): string {
  return keyBetween(null, sorted[0]?.position);
}

/**
 * Key for inserting at `index` in a sorted list that does not contain the moving item.
 */
export function keyAtIndex(sorted: Positioned[], index: number): string {
  return keyBetween(sorted[index - 1]?.position, sorted[index]?.position);
}
