import { describe, expect, it } from 'vitest';
import type { TimeEntry, TimeField } from '../db/types';
import { fieldApplies, fieldSuggestions, realmTagIds, recentProjectIds } from './timePicks';

const entry = (over: Partial<TimeEntry>): TimeEntry => ({
  id: crypto.randomUUID(),
  user_id: 'u',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  started_at: '',
  ended_at: null,
  project_id: null,
  time_task_id: null,
  tag_ids: [],
  description: null,
  fields: {},
  source: null,
  ...over,
});

const field = (over: Partial<TimeField>): TimeField => ({
  id: 'f',
  user_id: 'u',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  name: 'Game',
  kind: 'text',
  choices: [],
  position: 'a0',
  archived_at: null,
  area_id: null,
  ...over,
});

describe('time picker ordering', () => {
  it('suggests field values newest first, once each, ignoring case and blanks', () => {
    const entries = [
      entry({ fields: { game: 'Hades' } }),
      entry({ fields: { game: 'Zelda' } }),
      entry({ fields: { game: 'hades' } }),
      entry({ fields: { game: '  ' } }),
      entry({ fields: { platform: 'Switch' } }),
    ];
    expect(fieldSuggestions(entries, 'game')).toEqual(['Hades', 'Zelda']);
  });

  it("lists a realm's tags by use, then by how recently they were used", () => {
    const realmOf = (p: string | null) => (p === 'games' ? 'play' : 'work');
    const entries = [
      entry({ project_id: 'games', tag_ids: ['coop'] }),
      entry({ project_id: 'games', tag_ids: ['solo'] }),
      entry({ project_id: 'office', tag_ids: ['meeting', 'meeting2'] }),
      entry({ project_id: 'games', tag_ids: ['solo'] }),
    ];
    expect(realmTagIds(entries, 'play', realmOf)).toEqual(['solo', 'coop']);
    expect(realmTagIds(entries, 'home', realmOf)).toEqual([]);
  });

  it('lists recent projects newest first without repeats', () => {
    const entries = ['a', 'b', 'a', null, 'c', 'd'].map((p) => entry({ project_id: p }));
    expect(recentProjectIds(entries, 3)).toEqual(['a', 'b', 'c']);
  });

  it('shows a field everywhere without a realm, else only in its realm, and never when archived', () => {
    expect(fieldApplies(field({}), null)).toBe(true);
    expect(fieldApplies(field({ area_id: 'play' }), 'play')).toBe(true);
    expect(fieldApplies(field({ area_id: 'play' }), 'work')).toBe(false);
    expect(fieldApplies(field({ area_id: 'play' }), null)).toBe(false);
    expect(fieldApplies(field({ archived_at: 'x' }), null)).toBe(false);
  });
});
