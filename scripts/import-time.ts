// Import the old time entries from the portfolio's time_entries table into lula.
//
//   npm run import-time            dry run: what would be imported, and the merge list
//   npm run import-time -- --apply import
//
// Reads the portfolio with PORTFOLIO_SUPABASE_URL and PORTFOLIO_SUPABASE_ANON_KEY
// (.env.local; the table is publicly readable) and writes to lula as the owner.
// Entries keep their portfolio ids. Only rows lula doesn't have yet are written,
// so running it again (after a later Clockify import) adds the new entries and
// leaves anything already edited in lula alone. Mapping and merges: src/lib/timeImport.ts.

import { createClient } from '@supabase/supabase-js';
import { OLD_ZONE, planImport, type LulaProject, type OldEntry } from '../src/lib/timeImport';
import { fail, signIn, supabase } from './session';

const apply = process.argv.includes('--apply');
const url = process.env.PORTFOLIO_SUPABASE_URL;
const key = process.env.PORTFOLIO_SUPABASE_ANON_KEY;
if (!url || !key) fail('Add PORTFOLIO_SUPABASE_URL and PORTFOLIO_SUPABASE_ANON_KEY to .env.local, then try again.');
const portfolio = createClient(url, key, { auth: { persistSession: false } });

async function readAll<T>(client: typeof supabase, table: string, build: (q: any) => any = (q) => q): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(client.from(table).select('*')).range(from, from + 999);
    if (error) fail(`Reading ${table} failed: ${error.message}`);
    rows.push(...(data as T[]));
    if (data.length < 1000) return rows;
  }
}

const old = await readAll<OldEntry>(portfolio, 'time_entries', (q) => q.order('start_date').order('start_time').order('id'));
if (old.length === 0) fail('The portfolio returned no time entries (is the table still publicly readable?).');

const userId = await signIn();
const live = <T extends { deleted_at: string | null }>(r: T) => !r.deleted_at;
const realms = (await readAll<{ id: string; name: string; deleted_at: string | null }>(supabase, 'areas')).filter(live);
const projects = (
  await readAll<LulaProject & { is_inbox: boolean; track_time: boolean; deleted_at: string | null }>(supabase, 'projects')
).filter((p) => live(p) && !p.is_inbox);

const plan = await planImport(userId, old, realms, projects);

console.log(`${old.length} old entries, ${old[0].start_date} to ${old.at(-1)!.start_date} (times read as ${OLD_ZONE})\n`);
console.log('Clockify projects -> lula');
for (const p of plan.projects) console.log(`  ${p.project.padEnd(22)} -> ${(p.target ?? 'unsorted (no project)').padEnd(22)} ${p.entries}`);
console.log('\nTask names merged or corrected');
for (const m of plan.merges) console.log(`  ${m.target ?? 'Unsorted'}: ${m.from.map((f) => `"${f}"`).join(', ')} -> "${m.to}"`);
const turnOn = projects.filter((p) => plan.timeProjects.includes(p.id) && !p.track_time);
console.log(`\n${plan.tasks.length} tasks, ${plan.tags.length} tags`);
console.log(`time tracking turned on for: ${turnOn.map((p) => p.name).join(', ') || 'none (already on)'}`);
console.log(`tags: ${plan.tags.map((t) => t.name).join(', ')}`);
if (plan.durationMismatches.length) console.log(`\n${plan.durationMismatches.length} entries' times don't match their recorded duration: ${plan.durationMismatches.join(', ')}`);

if (!apply) {
  console.log('\nDry run: nothing written. Add --apply to import.');
  process.exit(0);
}

const base = { user_id: userId, deleted_at: null };
async function insertMissing(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase
      .from(table)
      .upsert(rows.slice(i, i + 500), { onConflict: 'id', ignoreDuplicates: true });
    if (error) fail(`Writing ${table} failed: ${error.message}`);
  }
}
const before = (await readAll<{ id: string }>(supabase, 'time_entries')).length;
if (turnOn.length) {
  const { error } = await supabase.from('projects').update({ track_time: true }).in('id', turnOn.map((p) => p.id));
  if (error) fail(`Turning on time tracking failed: ${error.message}`);
}
await insertMissing('time_tags', plan.tags.map((t) => ({ ...base, ...t, archived_at: null })));
await insertMissing('time_tasks', plan.tasks.map((t) => ({ ...base, ...t, task_id: null, archived_at: null })));
await insertMissing('time_entries', plan.entries.map((e) => ({ ...base, ...e, fields: {} })));
const after = (await readAll<{ id: string }>(supabase, 'time_entries')).length;
console.log(`\nImported ${after - before} new entries (lula now has ${after}).`);
