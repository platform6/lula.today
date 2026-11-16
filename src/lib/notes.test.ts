import { describe, expect, it } from 'vitest';
import { noteEntries } from './notes';

describe('note entries', () => {
  it('splits signed entries, keeping unsigned text first', () => {
    const notes = 'My own idea.\nSecond line.\n\n[Claude · Nov 16] Built it.\n\n[Codex · Nov 17, 9:05 AM] Checked:\n- one\n\n- two';
    expect(noteEntries(notes)).toEqual([
      { text: 'My own idea.\nSecond line.' },
      { stamp: { by: 'Claude', when: 'Nov 16' }, text: 'Built it.' },
      { stamp: { by: 'Codex', when: 'Nov 17, 9:05 AM' }, text: 'Checked:\n- one\n\n- two' },
    ]);
  });

  it('leaves plain notes and brackets mid-line alone', () => {
    expect(noteEntries('Buy milk [later · maybe]')).toEqual([{ text: 'Buy milk [later · maybe]' }]);
    expect(noteEntries('[todo] no dot here')).toEqual([{ text: '[todo] no dot here' }]);
    expect(noteEntries('')).toEqual([]);
  });

  it('keeps a signed entry with no text', () => {
    expect(noteEntries('[Claude · Nov 16]')).toEqual([{ stamp: { by: 'Claude', when: 'Nov 16' }, text: '' }]);
  });
});
