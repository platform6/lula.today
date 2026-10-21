// One-off import of a year from the old "Work log" Google Sheet, exported as CSV
// with the sheet's columns: Date (MM/DD/YY), Remote/Office (and an unused Bus).
//
//   npm run import-worklog -- <file.csv>                         dry run
//   npm run import-worklog -- <file.csv> --tickets <n> --apply   import
//
// --tickets is how many bus tickets you have now. It's recorded as the starting
// balance the day after the last office day in the file, so the work log counts
// down from there (the sheet's own running count isn't carried over). Ids are
// derived from the dates, so running it again updates the same rows.

import { readFileSync } from 'node:fs';
import type { WorkStatus } from '../src/db/types';
import { addDays } from '../src/lib/dates';
import { stableUuid } from '../src/lib/ids';
import { workDayId } from '../src/lib/worklog';
import { fail, signIn, supabase } from './session';

const STATUS: Record<string, WorkStatus> = {
  office: 'office',
  remote: 'remote',
  off: 'off',
  holiday: 'holiday',
  'jury duty/nh/off': 'jury',
};

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
if (!file) fail('Usage: npm run import-worklog -- <file.csv> [--tickets <n> --apply]');
const apply = args.includes('--apply');
const ticketsArg = args.indexOf('--tickets');
const tickets = ticketsArg === -1 ? null : Number(args[ticketsArg + 1]);
if (apply && (tickets === null || !Number.isInteger(tickets) || tickets < 0)) fail('--apply needs --tickets <how many you have now>');

const days: { day: string; status: WorkStatus }[] = [];
for (const line of readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(1)) {
  const [date, rawStatus] = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
  if (!rawStatus) continue; // a future day not filled in yet
  const status = STATUS[rawStatus.toLowerCase()];
  if (!status) fail(`Unknown status "${rawStatus}" on ${date}`);
  const [m, d, y] = date.split('/').map(Number);
  days.push({ day: `${2000 + (y % 100)}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, status });
}

const count = (s: WorkStatus) => days.filter((d) => d.status === s).length;
const office = count('office');
const remote = count('remote');
const lastOffice = days.filter((d) => d.status === 'office').at(-1)?.day;
const startOn = lastOffice ? addDays(lastOffice, 1) : days[0]?.day;
console.log(`${days.length} days, ${days[0]?.day} to ${days.at(-1)?.day}`);
console.log(`office ${office} · remote ${remote} · off ${count('off')} · holiday ${count('holiday')} · jury ${count('jury')}`);
console.log(`in office ${((office / (office + remote)) * 100).toFixed(2)}%`);
console.log(`ticket count starts ${startOn}${tickets === null ? '' : ` with ${tickets}`}`);

if (!apply) {
  console.log('\nDry run: nothing written. Add --tickets <n> --apply to import.');
  process.exit(0);
}

const userId = await signIn();
const dayRows = await Promise.all(
  days.map(async (d) => ({ id: await workDayId(userId, d.day), user_id: userId, day: d.day, status: d.status, deleted_at: null })),
);
const wroteDays = await supabase.from('work_days').upsert(dayRows, { onConflict: 'id' });
if (wroteDays.error) fail(`Writing work days failed: ${wroteDays.error.message}`);
console.log(`wrote ${dayRows.length} work days`);

if (tickets! > 0) {
  const start = {
    id: await stableUuid(`${userId}:bus_import:start`),
    user_id: userId,
    bought_on: startOn!,
    tickets: tickets!,
    deleted_at: null,
  };
  const wroteStart = await supabase.from('bus_purchases').upsert(start, { onConflict: 'id' });
  if (wroteStart.error) fail(`Writing the ticket count failed: ${wroteStart.error.message}`);
  console.log(`set ${tickets} tickets from ${startOn}`);
}
