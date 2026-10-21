import type { ListKind } from '../db/types';

export const LIST_KINDS: { value: ListKind; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'games', label: 'Video games' },
  { value: 'concerts', label: 'Concerts' },
  { value: 'television', label: 'Television' },
];

export const LIST_FIELDS: Record<ListKind, { key: string; label: string }[]> = {
  general: [],
  games: [{ key: 'platform', label: 'Platform' }, { key: 'playtime', label: 'Hours played' }],
  concerts: [{ key: 'artist', label: 'Artist / band' }, { key: 'venue', label: 'Venue' }, { key: 'city', label: 'City' }],
  television: [{ key: 'season', label: 'Season(s)' }, { key: 'episodes', label: 'Episodes watched' }, { key: 'service', label: 'Streaming service / network' }],
};

export const listKindLabel = (kind: ListKind) => LIST_KINDS.find((k) => k.value === kind)!.label;
