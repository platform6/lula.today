/**
 * A UUID derived from a name (SHA-256, formatted as a version-8 UUID).
 * Rows that every device may create independently, such as an area's built-in
 * project, use this so offline devices converge on the same row instead of
 * colliding on a unique index when they sync.
 *
 * Async (Web Crypto), so call it before opening a Dexie transaction.
 */
export async function stableUuid(name: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(name));
  const b = new Uint8Array(digest).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
