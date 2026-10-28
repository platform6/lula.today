// Command-line access to your lula boards, for working through them from a
// terminal (or Claude Code). Signs in as you, so Row Level Security applies,
// and follows the app's rules for card order, completion and recurring tasks.
//
//   npm run board -- help
//
// Signs in through scripts/session.ts (credentials in .env.local).

import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { byPosition, keyAtEnd } from '../src/lib/position';
import { nextDue } from '../src/lib/recurrence';
import { titleCase } from '../src/lib/titleCase';
import type { Area, Attachment, BoardColumn, Label, Project, Step, Task } from '../src/db/types';
import { fail, signIn, supabase } from './session';

async function rows<T>(table: string, build?: (q: any) => any): Promise<T[]> {
  let q = supabase.from(table).select('*').is('deleted_at', null);
  if (build) q = build(q);
  const { data, error } = await q;
  if (error) fail(`Reading ${table} failed: ${error.message}`);
  return data as T[];
}

async function update(table: string, id: string, changes: object) {
  const { error } = await supabase.from(table).update(changes).eq('id', id);
  if (error) fail(`Saving failed: ${error.message}`);
}

const short = (id: string) => id.slice(0, 8);
const norm = (s: string) => s.trim().toLowerCase();
const PRIORITY = ['', 'low', 'medium', 'high'];

function fmtDue(t: Task): string {
  if (!t.due_at) return '';
  const d = new Date(t.due_at);
  const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return t.due_has_time ? `${day} ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : day;
}

/** A project by name, a realm by name (its own task list), or "inbox". */
async function findProject(name: string): Promise<{ project: Project; label: string }> {
  const projects = (await rows<Project>('projects')).filter((p) => !p.archived_at);
  const areas = await rows<Area>('areas');
  const want = norm(name);
  if (want === 'inbox') {
    const inbox = projects.find((p) => p.is_inbox);
    if (inbox) return { project: inbox, label: 'Inbox' };
  }
  const exact = projects.filter((p) => !p.is_inbox && !p.is_area_default && norm(p.name) === want);
  if (exact.length === 1) return { project: exact[0], label: exact[0].name };
  const area = areas.find((a) => norm(a.name) === want);
  const own = area && projects.find((p) => p.is_area_default && p.area_id === area.id);
  if (own) return { project: own, label: `${area!.name} (realm tasks)` };
  if (exact.length > 1) fail(`More than one project is called "${name}".`);
  fail(`No project or realm called "${name}". Try: npm run board -- boards`);
}

/** Cards by id, comma-separated for several. All are found before anything changes, so a typo changes nothing. */
async function findTasks(ids: string): Promise<Task[]> {
  const prefixes = [...new Set(ids.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))];
  for (const p of prefixes) if (!/^[0-9a-f-]{4,36}$/.test(p)) fail(`"${p}" isn't a card id (use the 8-character id from "list").`);
  if (prefixes.length === 0) fail('Give a card id.');
  const all = await rows<Task>('tasks');
  return prefixes.map((p) => {
    const matches = all.filter((t) => t.id.startsWith(p));
    if (matches.length === 0) fail(`No card with id ${p}.`);
    if (matches.length > 1) fail(`Id ${p} matches ${matches.length} cards; use more characters.`);
    return matches[0];
  });
}

async function findTask(idPrefix: string): Promise<Task> {
  const found = await findTasks(idPrefix);
  if (found.length > 1) fail('Give one card id here.');
  return found[0];
}

async function columnsOf(projectId: string) {
  return (await rows<BoardColumn>('board_columns', (q) => q.eq('project_id', projectId))).sort(byPosition);
}

async function lastInColumn(columnId: string, exceptId?: string) {
  return (await rows<Task>('tasks', (q) => q.eq('column_id', columnId))).filter((t) => t.id !== exceptId).sort(byPosition);
}

// ---------------------------------------------------------------------------

async function boards() {
  const areas = (await rows<Area>('areas')).filter((a) => !a.archived_at).sort(byPosition);
  const projects = (await rows<Project>('projects')).filter((p) => !p.archived_at).sort(byPosition);
  console.log('Inbox');
  for (const a of areas) {
    console.log(`${a.name}   (realm tasks: "${a.name}")`);
    for (const p of projects.filter((p) => p.area_id === a.id && !p.is_area_default)) console.log(`  › ${p.name}`);
  }
}

async function list(name: string, onlyColumn?: string) {
  const { project, label } = await findProject(name);
  const columns = (await columnsOf(project.id)).filter((c) => !onlyColumn || norm(c.name) === norm(onlyColumn));
  const tasks = (await rows<Task>('tasks', (q) => q.eq('project_id', project.id))).filter((t) => !t.archived_at);
  const labels = new Map((await rows<Label>('labels')).map((l) => [l.id, l.name]));
  const links = await rows<{ task_id: string; label_id: string }>('task_labels');
  const tagsOf = (t: Task) => links.filter((l) => l.task_id === t.id).map((l) => labels.get(l.label_id)).filter(Boolean) as string[];
  const cardsIn = (c: BoardColumn) => tasks.filter((t) => t.column_id === c.id).sort(byPosition);
  if (json) {
    return out({
      board: label,
      columns: columns.map((c) => ({
        name: c.name,
        done: c.is_done,
        cards: cardsIn(c).map((t) => ({
          id: t.id,
          title: t.title,
          priority: PRIORITY[t.priority] || null,
          due_at: t.due_at,
          repeats: !!t.recurrence,
          tags: tagsOf(t),
          has_notes: !!t.notes,
        })),
      })),
    });
  }
  console.log(`# ${label}`);
  for (const c of columns) {
    const mine = cardsIn(c);
    console.log(`\n## ${c.name}${c.is_done ? ' (done)' : ''} · ${mine.length}`);
    for (const t of mine) {
      const tags = tagsOf(t);
      const meta = [PRIORITY[t.priority], fmtDue(t), t.recurrence ? 'repeats' : '', tags.length ? `#${tags.join(' #')}` : '', t.notes ? 'has notes' : '']
        .filter(Boolean)
        .join(' · ');
      console.log(`${short(t.id)}  ${t.title}${meta ? `   [${meta}]` : ''}`);
    }
  }
}

async function show(ids: string) {
  const cards = await findTasks(ids);
  const shown = [];
  for (const [i, t] of cards.entries()) {
    const column = (await rows<BoardColumn>('board_columns', (q) => q.eq('id', t.column_id)))[0];
    const project = (await rows<Project>('projects', (q) => q.eq('id', t.project_id)))[0];
    const steps = (await rows<Step>('steps', (q) => q.eq('task_id', t.id))).sort(byPosition);
    const files = await attachmentsOf(t.id);
    const commits = commitsFor(t.id);
    const board = project?.is_inbox ? 'Inbox' : project?.name;
    const state = t.cancelled_at ? 'cancelled' : t.completed_at ? 'completed' : 'open';
    if (json) {
      shown.push({
        id: t.id,
        title: t.title,
        board,
        column: column?.name,
        state,
        priority: PRIORITY[t.priority] || null,
        due_at: t.due_at,
        due_has_time: t.due_has_time,
        recurrence: t.recurrence,
        url: t.url,
        steps: steps.map((s) => ({ text: s.text, done: s.is_done })),
        files: files.map((f) => ({ name: f.name, mime_type: f.mime_type, size: f.size })),
        commits,
        notes: t.notes,
      });
      continue;
    }
    if (i > 0) console.log('\n---\n');
    printCard(t, `${board} › ${column?.name}${state === 'open' ? '' : ` (${state})`}`, steps, files, commits);
  }
  if (json) out(cards.length === 1 ? shown[0] : shown);
}

function printCard(t: Task, where: string, steps: Step[], files: Attachment[], commits: string[]) {
  console.log(`${t.title}`);
  console.log(`id ${t.id}`);
  console.log(`board ${where}`);
  if (t.priority) console.log(`priority ${PRIORITY[t.priority]}`);
  if (t.due_at) console.log(`due ${fmtDue(t)}`);
  if (t.recurrence) console.log(`repeats ${JSON.stringify(t.recurrence)}`);
  if (t.url) console.log(`link ${t.url}`);
  if (steps.length) {
    console.log('steps');
    for (const s of steps) console.log(`  [${s.is_done ? 'x' : ' '}] ${s.text}`);
  }
  if (files.length) {
    console.log('files');
    for (const f of files) console.log(`  ${f.name} (${f.mime_type ?? 'unknown type'}, ${Math.round(f.size / 1024)} KB)`);
  }
  if (commits.length) {
    console.log('commits');
    for (const c of commits) console.log(`  ${c}`);
  }
  if (t.notes) console.log(`notes\n${t.notes}`);
}

/** Commits with a "Card: <id>" line for this card, newest first (none outside a git checkout). */
function commitsFor(id: string): string[] {
  try {
    const log = execFileSync('git', ['log', '--format=%h %ad %s', '--date=short', '-i', `--grep=^Card: *${short(id)}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return log.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

async function attachmentsOf(taskId: string) {
  return (await rows<Attachment>('attachments', (q) => q.eq('task_id', taskId))).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Download a card's attached files into a folder (a temp folder by default). */
async function files(idPrefix: string, dir?: string) {
  const t = await findTask(idPrefix);
  const list = await attachmentsOf(t.id);
  if (list.length === 0) return console.log(`"${t.title}" has no files.`);
  const out = dir ?? join(tmpdir(), 'lula-files', short(t.id));
  await mkdir(out, { recursive: true });
  for (const [i, f] of list.entries()) {
    const { data, error } = await supabase.storage.from('attachments').download(f.path);
    if (error || !data) fail(`Downloading ${f.name} failed: ${error?.message}`);
    // Numbered so files with the same name don't overwrite each other.
    const file = join(out, `${String(i + 1).padStart(2, '0')}-${f.path.split('/').pop()}`);
    await writeFile(file, Buffer.from(await data.arrayBuffer()));
    console.log(file);
  }
}

async function move(t: Task, columnName: string) {
  const columns = await columnsOf(t.project_id);
  const target = columns.find((c) => norm(c.name) === norm(columnName));
  if (!target) fail(`No column "${columnName}" here. Columns: ${columns.map((c) => c.name).join(', ')}`);

  if (target.is_done && !t.completed_at && t.recurrence) {
    // Same as the app: a recurring card comes back with its next due date.
    const next = nextDue(t.recurrence, t.due_at);
    if (next) {
      const open = columns.find((c) => c.id === t.column_id && !c.is_done) ?? columns.find((c) => !c.is_done);
      await update('tasks', t.id, {
        due_at: next.toISOString(),
        recurrence: { ...t.recurrence, done: (t.recurrence.done ?? 0) + 1 },
        ...(open && open.id !== t.column_id ? { column_id: open.id, position: keyAtEnd(await lastInColumn(open.id, t.id)) } : {}),
      });
      console.log(`Repeats: "${t.title}" is next due ${next.toLocaleDateString()}.`);
      return;
    }
  }
  const completed_at = target.is_done ? (t.completed_at ?? new Date().toISOString()) : null;
  await update('tasks', t.id, {
    column_id: target.id,
    position: keyAtEnd(await lastInColumn(target.id, t.id)),
    completed_at,
    ...(t.recurrence && completed_at && !t.completed_at ? { recurrence: { ...t.recurrence, done: (t.recurrence.done ?? 0) + 1 } } : {}),
  });
  console.log(`Moved "${t.title}" to ${target.name}.`);
}

async function note(t: Pick<Task, 'id' | 'title' | 'notes'>, text: string, by = 'Claude') {
  const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const entry = `[${by} · ${stamp}] ${text}`;
  await update('tasks', t.id, { notes: t.notes ? `${t.notes}\n\n${entry}` : entry });
  if (!json) console.log(`Added a note to "${t.title}".`);
}

/** Add steps to the end of a card's checklist, one per text. */
async function addSteps(t: Pick<Task, 'id' | 'title'>, texts: string[]) {
  const existing = (await rows<Step>('steps', (q) => q.eq('task_id', t.id))).sort(byPosition);
  const list = [...existing];
  for (const text of texts) {
    const position = keyAtEnd(list);
    const { error } = await supabase.from('steps').insert({ id: randomUUID(), task_id: t.id, text: text.trim(), is_done: false, position });
    if (error) fail(`Adding a step failed: ${error.message}`);
    list.push({ position } as Step);
  }
  if (!json) console.log(`Added ${texts.length} step${texts.length === 1 ? '' : 's'} to "${t.title}".`);
}

async function add(name: string, title: string, columnName?: string, extra: { note?: string; steps: string[]; by?: string } = { steps: [] }) {
  const { project, label } = await findProject(name);
  const columns = await columnsOf(project.id);
  const column = columnName
    ? columns.find((c) => norm(c.name) === norm(columnName))
    : (columns.find((c) => !c.is_done) ?? columns[0]);
  if (!column) fail(columnName ? `No column "${columnName}". Columns: ${columns.map((c) => c.name).join(', ')}` : 'That board has no columns.');
  const id = randomUUID();
  const { error } = await supabase.from('tasks').insert({
    id,
    project_id: project.id,
    column_id: column.id,
    title: titleCase(title),
    priority: 0,
    due_has_time: false,
    completed_at: column.is_done ? new Date().toISOString() : null,
    position: keyAtEnd(await lastInColumn(column.id)),
  });
  if (error) fail(`Adding failed: ${error.message}`);
  const card = { id, title: titleCase(title), notes: null };
  if (!json) console.log(`Added ${short(id)} "${card.title}" to ${label} › ${column.name}.`);
  if (extra.note) await note(card, extra.note, extra.by);
  if (extra.steps.length) await addSteps(card, extra.steps);
  if (json) out({ id, title: card.title, board: label, column: column.name });
}

const HELP = `lula board

  boards                          realms and their projects
  list <board> [column]           cards by column, with their ids
  show <ids>                      cards: notes, steps, files, commits, details
  files <id> [folder]             download a card's files (to a temp folder by default)
  move <ids> <column>             move cards (Done completes them)
  note <ids> "<text>" [--by name] append a note to cards (signed Claude unless --by)
  step <id> "<text>" ["<text>"…]  add steps to the end of a card's checklist
  add <board> "<title>" [column]  add a card (first open column by default),
      [--note "<text>"] [--step "<text>"]…   with a note and steps

  --file <path>   note and step: read the text from a file ("-" reads stdin);
                  for step, each non-empty line is a step
  --json          list, show and add: print JSON (add prints the new card's full id)

<board> is a project name, a realm name (its own tasks) or "inbox".
<id> is the 8-character id from "list"; <ids> is one, or several with commas: a1b2c3d4,e5f6a7b8.`;

// Flags may go anywhere; "--" ends them.
const VALUE_FLAGS = ['--by', '--file', '--note', '--step'];
const args: string[] = [];
const flags: Record<string, string[]> = {};
let json = false;
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      args.push(...argv.slice(i + 1));
      break;
    } else if (a === '--json') json = true;
    else if (VALUE_FLAGS.includes(a)) {
      if (argv[i + 1] === undefined) fail(`${a} needs a value.\n\n${HELP}`);
      (flags[a.slice(2)] ??= []).push(argv[++i]);
    } else args.push(a);
  }
}
const cmd = args.shift();
const flag = (name: string) => flags[name]?.at(-1);
const need = (n: number) => {
  if (args.length < n) fail(HELP);
};
const out = (value: unknown) => console.log(JSON.stringify(value, null, 2));

/** The --file's text, if given ("-" is stdin). */
function fileText(): string | undefined {
  const file = flag('file');
  if (file === undefined) return undefined;
  try {
    return readFileSync(file === '-' ? 0 : file, 'utf8').trim();
  } catch (e) {
    fail(`Reading ${file === '-' ? 'stdin' : file} failed: ${e instanceof Error ? e.message : e}`);
  }
}

if (!cmd || cmd === 'help') {
  console.log(HELP);
} else {
  await signIn();
  if (cmd === 'boards') await boards();
  else if (cmd === 'list') (need(1), await list(args[0], args[1]));
  else if (cmd === 'show') (need(1), await show(args[0]));
  else if (cmd === 'files') (need(1), await files(args[0], args[1]));
  else if (cmd === 'move') {
    need(2);
    const column = args.slice(1).join(' ');
    for (const t of await findTasks(args[0])) await move(t, column);
  } else if (cmd === 'note') {
    need(1);
    const text = fileText() ?? args.slice(1).join(' ');
    if (!text) fail(HELP);
    for (const t of await findTasks(args[0])) await note(t, text, flag('by'));
  } else if (cmd === 'step') {
    need(1);
    const file = fileText();
    const texts = (file === undefined ? args.slice(1) : file.split(/\r?\n/)).map((s) => s.trim()).filter(Boolean);
    if (texts.length === 0) fail(HELP);
    await addSteps(await findTask(args[0]), texts);
  } else if (cmd === 'add') {
    need(2);
    await add(args[0], args[1], args[2], { note: flag('note'), steps: flags.step ?? [], by: flag('by') });
  } else fail(HELP);
}
