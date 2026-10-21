// Command-line access to your lula boards, for working through them from a
// terminal (or Claude Code). Signs in as you, so Row Level Security applies,
// and follows the app's rules for card order, completion and recurring tasks.
//
//   npm run board -- help
//
// Signs in through scripts/session.ts (credentials in .env.local).

import { randomUUID } from 'node:crypto';
import { byPosition, keyAtEnd } from '../src/lib/position';
import { nextDue } from '../src/lib/recurrence';
import { titleCase } from '../src/lib/titleCase';
import type { Area, BoardColumn, Label, Project, Step, Task } from '../src/db/types';
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

async function findTask(idPrefix: string): Promise<Task> {
  if (!/^[0-9a-f-]{4,36}$/i.test(idPrefix)) fail(`"${idPrefix}" isn't a card id (use the 8-character id from "list").`);
  const matches = (await rows<Task>('tasks')).filter((t) => t.id.startsWith(idPrefix.toLowerCase()));
  if (matches.length === 0) fail(`No card with id ${idPrefix}.`);
  if (matches.length > 1) fail(`Id ${idPrefix} matches ${matches.length} cards; use more characters.`);
  return matches[0];
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
  const columns = await columnsOf(project.id);
  const tasks = (await rows<Task>('tasks', (q) => q.eq('project_id', project.id))).filter((t) => !t.archived_at);
  const labels = new Map((await rows<Label>('labels')).map((l) => [l.id, l.name]));
  const links = await rows<{ task_id: string; label_id: string }>('task_labels');
  console.log(`# ${label}`);
  for (const c of columns) {
    if (onlyColumn && norm(c.name) !== norm(onlyColumn)) continue;
    const mine = tasks.filter((t) => t.column_id === c.id).sort(byPosition);
    console.log(`\n## ${c.name}${c.is_done ? ' (done)' : ''} · ${mine.length}`);
    for (const t of mine) {
      const tags = links.filter((l) => l.task_id === t.id).map((l) => labels.get(l.label_id)).filter(Boolean);
      const meta = [PRIORITY[t.priority], fmtDue(t), t.recurrence ? 'repeats' : '', tags.length ? `#${tags.join(' #')}` : '', t.notes ? 'has notes' : '']
        .filter(Boolean)
        .join(' · ');
      console.log(`${short(t.id)}  ${t.title}${meta ? `   [${meta}]` : ''}`);
    }
  }
}

async function show(idPrefix: string) {
  const t = await findTask(idPrefix);
  const column = (await rows<BoardColumn>('board_columns', (q) => q.eq('id', t.column_id)))[0];
  const project = (await rows<Project>('projects', (q) => q.eq('id', t.project_id)))[0];
  const steps = (await rows<Step>('steps', (q) => q.eq('task_id', t.id))).sort(byPosition);
  console.log(`${t.title}`);
  console.log(`id ${t.id}`);
  console.log(
    `board ${project?.is_inbox ? 'Inbox' : project?.name} › ${column?.name}${t.cancelled_at ? ' (cancelled)' : t.completed_at ? ' (completed)' : ''}`,
  );
  if (t.priority) console.log(`priority ${PRIORITY[t.priority]}`);
  if (t.due_at) console.log(`due ${fmtDue(t)}`);
  if (t.recurrence) console.log(`repeats ${JSON.stringify(t.recurrence)}`);
  if (t.url) console.log(`link ${t.url}`);
  if (steps.length) {
    console.log('steps');
    for (const s of steps) console.log(`  [${s.is_done ? 'x' : ' '}] ${s.text}`);
  }
  if (t.notes) console.log(`notes\n${t.notes}`);
}

async function move(idPrefix: string, columnName: string) {
  const t = await findTask(idPrefix);
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

async function note(idPrefix: string, text: string) {
  const t = await findTask(idPrefix);
  const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const entry = `[Claude · ${stamp}] ${text}`;
  await update('tasks', t.id, { notes: t.notes ? `${t.notes}\n\n${entry}` : entry });
  console.log(`Added a note to "${t.title}".`);
}

async function add(name: string, title: string, columnName?: string) {
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
  console.log(`Added ${short(id)} "${titleCase(title)}" to ${label} › ${column.name}.`);
}

const HELP = `lula board

  boards                          realms and their projects
  list <board> [column]           cards by column, with their ids
  show <id>                       one card: notes, steps, details
  move <id> <column>              move a card (Done completes it)
  note <id> "<text>"              append a note to a card
  add <board> "<title>" [column]  add a card (first open column by default)

<board> is a project name, a realm name (its own tasks) or "inbox".
<id> is the 8-character id from "list".`;

const [cmd, ...args] = process.argv.slice(2);
const need = (n: number) => {
  if (args.length < n) fail(HELP);
};

if (!cmd || cmd === 'help') {
  console.log(HELP);
} else {
  await signIn();
  if (cmd === 'boards') await boards();
  else if (cmd === 'list') (need(1), await list(args[0], args[1]));
  else if (cmd === 'show') (need(1), await show(args[0]));
  else if (cmd === 'move') (need(2), await move(args[0], args.slice(1).join(' ')));
  else if (cmd === 'note') (need(2), await note(args[0], args.slice(1).join(' ')));
  else if (cmd === 'add') (need(2), await add(args[0], args[1], args[2]));
  else fail(HELP);
}
