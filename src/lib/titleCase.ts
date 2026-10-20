// Title case for task and step text, e.g. "book dentist appointment for friday"
// → "Book Dentist Appointment for Friday".
//
// - Short articles, conjunctions and prepositions stay lowercase, except as the
//   first or last word or right after a colon.
// - Words you typed with any capital are left alone (iPhone, PR, NASA).
// - Links, email addresses and anything containing a digit are left alone.

const SMALL = new Set([
  'a', 'an', 'the',
  'and', 'but', 'or', 'nor', 'for', 'so', 'yet',
  'as', 'at', 'by', 'in', 'of', 'off', 'on', 'per', 'to', 'up', 'via', 'vs',
]);

const isUntouchable = (word: string) =>
  /[A-Z]/.test(word) || // already has a capital: respect it
  /\d/.test(word) || // 3pm, Q4, 2nd
  /@|:\/\/|^www\./i.test(word) || // email, link
  /^[\w-]+\.[a-z]{2,}(\/|$)/i.test(word); // bare domain like example.com

/** Capitalize the first letter, skipping leading punctuation such as ( or ". */
const capitalize = (word: string) => word.replace(/\p{L}/u, (c) => c.toUpperCase());

/** Hyphenated words capitalize each part: follow-up → Follow-Up. */
const capitalizeParts = (word: string) => word.split('-').map(capitalize).join('-');

export function titleCase(text: string): string {
  const parts = text.split(/(\s+)/); // keep the original spacing
  const wordIndexes = parts.flatMap((p, i) => (p.trim() ? [i] : []));
  const first = wordIndexes[0];
  const last = wordIndexes[wordIndexes.length - 1];

  let afterColon = false;
  for (const i of wordIndexes) {
    const word = parts[i];
    const bare = word.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').toLowerCase();
    const forceCap = i === first || i === last || afterColon;
    afterColon = /:$/.test(word);
    if (isUntouchable(word)) continue;
    parts[i] = SMALL.has(bare) && !forceCap ? word : capitalizeParts(word);
  }
  return parts.join('');
}
