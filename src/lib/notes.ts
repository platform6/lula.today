// Task notes can hold signed entries, written by the board script (and agents) as
// "[Claude · Nov 16, 12:30 PM] text" at the start of a line. Split them out so the
// app can show who and when as a badge instead of the bracketed text.

export interface NoteEntry {
  /** Who signed it and when, e.g. { by: 'Claude', when: 'Nov 16, 12:30 PM' }; none for unsigned text. */
  stamp?: { by: string; when: string };
  text: string;
}

const STAMP = /^\[([^\]\n·]+?) · ([^\]\n]+)\][ \t]*/gm;

/** The notes as entries in order: any unsigned text first, then one per signed entry. */
export function noteEntries(notes: string): NoteEntry[] {
  const out: NoteEntry[] = [];
  const stamps = [...notes.matchAll(STAMP)];
  const before = notes.slice(0, stamps[0]?.index ?? notes.length).trim();
  if (before) out.push({ text: before });
  stamps.forEach((m, i) => {
    const end = stamps[i + 1]?.index ?? notes.length;
    out.push({ stamp: { by: m[1].trim(), when: m[2].trim() }, text: notes.slice(m.index! + m[0].length, end).trim() });
  });
  return out;
}
