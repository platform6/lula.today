# lula.today

Personal, offline-first PWA for tracking time and tasks: a Clockify-style time tracker on top of a
realm → project → task manager with per-project kanban boards. Single user; installable on iPhone;
Supabase for auth and sync; hosted on Netlify.

Original scope and sync design: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) (written before time
tracking, so its naming and nav are out of date; this README describes the app as it is).

## What's in the app

**Time** (home, `/`)
- One running timer per person across devices. Start from + (description first, then project, task and
  tags, or tap a recent entry to start it again), from Track time on a card, or with play on any entry.
  The running timer is a tinted bar with a live clock, Switch and Stop; after 8 hours it turns amber and
  offers Stop at….
- Entries: every entry newest first, grouped by week and day with totals; repeats on a day stack;
  tap to edit, swipe left to delete with Undo. Entries with no project wait in a bar at the top.
- Report: This week, Last week, Past two weeks, This month, Last month or Custom, stepped with < >;
  total, hours per day (per week or month for long ranges), a donut by realm, a breakdown by project
  or task; filters for realm, task and tag; JSON export.
- Projects (and a realm's own list) can track time, show a board, or both; each has a Board | Time view.
- Durations read 00:00:00 everywhere, with exact times and no rounding.

**Tasks**
- Realms (ongoing areas, drag to reorder) → projects (finite; complete to archive) → tasks → steps.
  Every realm has its own task list as well as projects.
- Kanban boards with configurable columns per project; a task is complete in a done column, and
  completed tasks auto-archive after 7 days. Tasks can also be cancelled.
- Task fields: notes, URL, priority, due date and time, repeat rules, tags, steps, file attachments,
  and a copyable id.
- Sorting (the inbox): + → New task captures here; sort mode files tasks one at a time.
- Today, Calendar (with bank holidays), All tasks, Search (on-device, includes archived), Archive.

**Also**
- Lists: standalone lists (General, Video games, Concerts, Television) with dated, rated entries.
- Work log: office, remote and off days, in-office percentage, bus tickets, printable by year.
- Settings: appearance, realm colors, completing tasks, default columns, tags, sync status, a guide to
  working on lula with Claude, iPhone install steps, and account.

**Navigation:** phone tabs are Time · Today · Realms · Search · More, with + for Start timer, Add time or
New task. On desktop the sidebar can be resized, hidden to a rail, and its page links folded to give
the realm tree room.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit and component tests (vitest, fake IndexedDB, Testing Library on jsdom)
npm run typecheck
npm run build      # type-check + production build into dist/
npm run icons      # regenerate PWA icons from public/favicon.svg
```

`.env` (gitignored) holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`; both are public by
design and RLS protects the data. `.env.local` (gitignored, owner's computer only) holds the owner's
login for the scripts below and the portfolio's URL and key for the time import.

| Script | What it does |
|---|---|
| `npm run board -- list\|show\|move\|note\|files` | Read and update cards on the lula board (see AGENTS.md) |
| `npm run import-time [-- --apply]` | Import time entries from the portfolio (Clockify copy); dry run without `--apply`; re-runnable, adds only new entries |
| `npm run import-worklog` | One-off import of the old work log |

## How it fits together

| Path | Role |
|---|---|
| `src/db/db.ts` | Dexie (IndexedDB) schema: local copy of every synced table + `outbox` + `meta` |
| `src/db/mutate.ts` | All local writes; each queues an outbox entry (with the changed columns) in the same transaction |
| `src/db/actions.ts`, `time.ts`, `lists.ts`, `attachments.ts` | Domain operations for tasks, time, lists and files |
| `src/sync/engine.ts`, `plan.ts` | Push the outbox (new rows whole, edits as column-only updates), pull by server `updated_at`, live updates over Realtime; refused rows and failed syncs retry with back-off |
| `src/lib/time.ts`, `report.ts`, `dates.ts` | Pure helpers: durations, report ranges and sums, day labels, timezone conversion |
| `src/components/Report.tsx`, `TimeReport.tsx`, `Timer.tsx`, `TimeEntrySheet.tsx`, `TimePickers.tsx` | The time tracker UI |
| `src/components/Layout.tsx`, `Sidebar.tsx`, `BottomNav.tsx` | Shell: sidebar, phone tabs, + menu, timer dock |
| `src/pages/*` | One file per route |
| `supabase/migrations/` | Postgres schema, RLS, `updated_at` triggers, auto-archive cron, one-running-timer trigger |
| `scripts/` | Board, import and asset scripts (run with tsx) |

Rows use client-made UUIDs and soft deletes (`deleted_at`). Edits push only the columns they changed, so
an older copy on another device can't undo newer changes; new rows are last-write-wins. The server keeps
one running timer per person (the most recently started wins). Migrations are applied by hand; see
"Database changes" in AGENTS.md.
