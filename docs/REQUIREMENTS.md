# Listing Things, Living Life — Requirements & Scope

_Status: v3 · 2026-10-27 (v2 was 2026-10-20, before time tracking)_

A personal, offline-first PWA installed on iPhone and used from a work browser. Single user (me).
Two jobs: **track time** (replacing Clockify) and **capture and organise tasks** into realms →
projects → kanban boards. Not a team/Jira-style tool.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Users | Single user. No assignees, sharing, or invites. Public sign-ups disabled. |
| Auth | Supabase Auth, email + password. |
| Primary device | iPhone (installed to Home Screen) + desktop browser at work. |
| Offline | **Full offline read/write is required**, with sync when back online. |
| Backend | Dedicated Supabase project. |
| Home screen | **Time** (`/`). Time tracking is the main daily use; tasks come second. |
| Kanban columns | Configurable **per project** via a settings screen. |
| Search | Must work offline. |
| Theme | Dark mode by default. |
| Hierarchy | Realms → Projects → Tasks → Steps. A realm also has its own task list. |
| Archiving | Completed tasks auto-archive 7 days after completion; archived tasks are kept indefinitely. |
| Time tracking | Clockify-style. Lula projects (and a realm's own list) are the time projects. One running timer at a time across devices. Exact times, no rounding. No billing, clients or teams. |
| Clockify cutover | Lula runs alongside Clockify in UAT until the end of 2026, then Clockify stops (see §7). |
| Hosting | Netlify, custom domain `lula.today` (DNS managed by Netlify). |
| Supabase project | `lula` (ref `hobsxhmxjxyhzyoyoufj`), org `dinner`, region `us-east-1`. |

## 2. Tech stack

- **React + Vite + TypeScript** (client-only SPA)
- **vite-plugin-pwa** (Workbox): manifest, precached app shell, installability
- **Tailwind CSS v4**: dark-first theme
- **Dexie (IndexedDB)**: local database; the UI reads and writes here
- **Custom sync engine**: outbox push + incremental pull + Realtime nudges (see §5)
- **dnd-kit**: touch-friendly drag and drop (cards, realms, Sorting tasks onto realms)
- **MiniSearch**: on-device full-text search
- **fractional-indexing**: conflict-friendly ordering of cards, columns and realms
- **Supabase**: Auth, Postgres, Row Level Security, Realtime, Storage (attachments), pg_cron
- **Hosting**: Netlify (static deploy, HTTPS, SPA redirect rule)

## 3. Functional requirements

### 3.1 Authentication
- Sign in with email + password; sign out; password reset by email.
- The session persists, and the app opens **offline** with the cached session.
- Sign-ups disabled in Supabase; the single account is created by hand.

### 3.2 Time tracking

**Timer**
- One timer runs at a time, across all devices. Starting one stops the running one (the server keeps the most recently started if two devices race).
- Start from **+ → Start timer**: "What are you working on?" first, then Project, Task and Tags; or tap a recent entry under *Start again*. Also from **Track time** on a card and **play** on any entry.
- The running timer is the loudest thing on screen: a tinted bar with a live clock, **Switch** (start something else) and **Stop**. On phones it docks above the tabs (at the top of the Time page instead); on desktop it sits in the sidebar.
- After 8 hours it turns amber, shows when it started, and offers **Stop at…** to stop it at the real end time.

**Entries**
- Fields: start, end (empty while running), project, task, description, tags, extra fields.
- Add past time with **+ → Add time**. The form has Date, Start, End and Duration together (Duration takes 1:30, 1:30:15, 1h 30m, 45m); then description, and pickers for Project (by realm, with search), Task (create in place) and Tags (active/archived, create in place).
- Validation: no future times, end after start. Closing with unsaved changes asks before discarding.
- The Entries list shows every entry newest first, grouped by week and day with totals. Repeats on a day (same project, task, description and tags) stack behind a count. Tap to edit; swipe left to delete, with Undo.
- Entries with no project show in a folded bar at the top of the Time page until given one.
- Durations read **00:00:00** everywhere.

**Reports**
- Periods: This week, Last week, Past two weeks, This month, Last month, Custom (From/To), stepped with < >.
- Total; hours per day (per week or month for long ranges); a donut by realm with each realm's total and share; a breakdown by project, or by task on a project page.
- Filters: realm, task, tag. **Export as JSON** with names filled in.
- Each time-tracking project has a **Board | Time** view with the same Entries and Report, scoped to it.

**Data**
- Projects opt in with **Time tracking** (and/or **Kanban board**) in their options.
- Time tasks are plain names per project; time tags are separate from task tags.
- History came from Clockify via the portfolio site's `time_entries` table (`npm run import-time`, re-runnable, adds only new entries; old times read as US Eastern).

### 3.3 Organisation

The model: **Sorting → Realm → Project**. New tasks are captured into Sorting (the inbox), then filed into a realm and optionally a project.

```
Sorting                    capture only; sorted out of, never worked in
Realm: Home                ongoing; never "done"
 ├─ (the realm's own list) tasks that belong to the realm but no project
 ├─ Project: Garage clean-out
 └─ Project: Kitchen reno  finite; completed and archived when finished
```

**Sorting**
- Built in, one per user. **+ → New task** (or `n`) always captures here.
- A list, not a board. Each task has **Move to…** (realm, then optionally a project), and tasks can be dragged onto a realm in the sidebar.
- **Sort mode** steps through tasks one at a time: each realm, its projects, "Do today", Delete, Skip.
- The Sorting count shows in the sidebar and on the More tab; empty reads as "Inbox zero".

**Realms**
- e.g. Work, Home, Video Games: name, colour, icon, order (drag to reorder). Realms have no completion state.
- Each realm's own task list is a hidden project flagged `is_area_default`; the UI shows it as the realm itself.

**Projects**
- Every project belongs to a realm. Name, description, optional due date, colour (defaults to the realm's), progress ("6 of 10 done"), **Complete project** to archive it.
- A project shows a kanban board, tracks time, or both.

**Wayfinding**
- Breadcrumbs wherever a task or board appears: **Work › Website redesign**, or **Work** alone.
- **Phone tabs:** Time · Today · Realms · Search · More. More holds Sorting, Lists, Calendar, Work log, All tasks, Archive and Settings.
- **+** (on every page) opens Start timer, Add time or New task; on a project or realm page the timer and time start on it.
- **Desktop sidebar:** brand and sync badge, timer, foldable page links, the realm tree, Lists, Settings. It can be resized (240–480px), hidden to a rail, and remembers both per device.

### 3.4 Tasks
| Field | Required | Notes |
|---|---|---|
| Title | ✓ | Title-cased on save (also steps); words you capitalised, links, emails and numbers are left alone |
| Notes | | Plain text / light markdown |
| URL | | Optional link, opens in a new tab |
| Project | ✓ | Sorting on capture; a realm's own list for realm-only tasks |
| Column | ✓ | Defaults to the project's first column |
| Priority | | None / Low / Medium / High |
| Due date | | Date, optional time |
| Repeat | | Repeat rules; the next one is created when one is completed |
| Tags | | Many-to-many (stored as `labels`) |
| Steps | | Ordered subtasks: text, done state |
| Attachments | | Files in Supabase Storage |
| Completed / cancelled | | Completed when moved into a done column; cancelled tasks go to the Archive |

- Each task has a short id with copy-to-clipboard, for referring to it when working with Claude.
- Edit in a sheet (bottom sheet on phones, centred modal on desktop). Steps are added, checked, reordered and deleted inline.
- Completing can ask for confirmation (a setting) and celebrates.

#### Archiving
- Completed tasks **auto-archive 7 days after `completed_at`** (nightly `pg_cron`; the client also hides them past 7 days, so this works offline).
- Tasks can be archived or cancelled manually. Archived tasks are kept indefinitely, filterable by realm/project, searchable and restorable.

### 3.5 Kanban board (per project)
- Columns side by side; swipe/scroll on phones. Drag cards between and within columns (touch + mouse).
- Cards show title, priority, due date, tags, steps progress (2/5), a link icon, and Track time on time-tracking projects.

### 3.6 Project settings: columns
- Add, rename, reorder and delete columns; mark one or more as **done**.
- Deleting a non-empty column asks where its tasks go.
- New projects get the default template (Settings; initially Backlog · To Do · Doing · Done).

### 3.7 Cross-project views
- **Today**: due today, overdue, and the next 7 days, with a prompt when Sorting has tasks.
- **Calendar**: upcoming scheduled tasks by day, with national bank holidays and weekends shaded.
- **All tasks**: filters for realm, project, tag, priority, due range and done; sort by priority (remembered).

### 3.8 Search
- `/` on desktop; the Search tab on phones. Searches titles, notes, URLs, steps, tags and project/realm names.
- Includes archived tasks in a separate, de-emphasised group. Runs on-device and works offline.

### 3.9 Lists
- Standalone lists (General, Video games, Concerts, Television) with entries that have dates, ratings, notes, links and category fields. Separate from tasks and from time tracking.

### 3.10 Work log
- Office, remote and off days; in-office percentage; bus ticket purchases; opens on today or the last unfilled day; printable by year.

### 3.11 Settings
- Appearance (theme, text size), realm colours, completing tasks, default columns, tags, sync status ("sync now", pending changes), a guide to working on lula with Claude, iPhone install steps, account.

## 4. Non-functional requirements

- **Offline-first**: every feature works without a network connection (attachment uploads wait for one).
- **Performance**: interactions update immediately from the local DB; no waiting on the network.
- **Mobile-first UI**: one-handed use, safe-area insets, **44px+ touch targets**.
- **Security**: RLS on every table restricting rows to `auth.uid()`; only the publishable key ships to the client. Service keys never go in the browser or the repo.
- **Data durability**: request persistent storage; the server is the durable backup.
- **Accessibility**: keyboard navigable on desktop, dialogs trap focus and return it, sufficient contrast in both themes.

## 5. Offline & sync design

The local Dexie DB is the source of truth for the UI; Supabase is the sync target and backup.

- **Client-generated UUIDs** for all rows, so records can be created offline.
- **Writes** update Dexie and append to an **outbox** in the same transaction. An edit records which columns it changed.
- **Push**: new rows (and rows the server doesn't have) are upserted whole; edits send **only their changed columns**, so an older copy on another device can't undo newer changes (restart a stopped timer, bring back something deleted).
- **Pull**: rows where server `updated_at > cursor` (minus a 5-second overlap). Rows with unpushed local changes are never overwritten by a pull.
- **Server timestamps**: a trigger sets `updated_at = now()` on every write, so cursors don't depend on device clocks.
- **Server rules**: one running timer per person (a trigger stops the older one, backed by a unique index).
- **Deletes** are soft (`deleted_at`) so they propagate.
- **Ordering**: fractional index strings for `position`.
- **Triggers to sync**: launch, returning to the foreground, `online`, shortly after local writes, Realtime change events (live updates within seconds), every minute while open, and "sync now". iOS has no Background Sync API, so sync only runs while the app is open.
- **Migrations** are applied by hand before the code that needs them ships (see AGENTS.md).

**iOS caveats**
- The Home Screen PWA has its own storage, separate from Safari; log in inside the installed app.
- Safari can evict storage for sites not installed; the server copy is the real backup.
- Push notifications need an installed PWA on iOS 16.4+ (for a later reminders phase).

## 6. Data model (Postgres; mirrored in Dexie)

All tables include `id uuid pk`, `user_id uuid` (default `auth.uid()`), `created_at`, `updated_at` (trigger), and `deleted_at`.

```
areas            name, color, icon, position, archived_at?            (realms)
projects         area_id?, name, color, description, due_date?, is_inbox, is_area_default,
                 show_board, track_time, completed_at?, archived_at?, position
board_columns    project_id, name, is_done, position
tasks            project_id, column_id, title, notes?, url?, priority, due_at?, due_has_time,
                 recurrence?, completed_at?, cancelled_at?, archived_at?, position
steps            task_id, text, is_done, position
labels           name, color                                         (task tags)
task_labels      task_id, label_id
attachments      task_id, name, mime_type, size, path              (files in Storage)
settings         one row per user: default_columns, theme
lists            name, kind, description
list_items       list_id, title, experienced_on, rating, notes, url, details
work_days        day, status (office / remote / off)
bus_purchases    bought_on, tickets
time_entries     started_at, ended_at?, project_id?, time_task_id?, tag_ids[], description,
                 fields jsonb, source
time_tasks       project_id?, name, task_id?, archived_at?
time_tags        name, archived_at?
time_fields      name, kind (text / choice), choices, position    (no UI yet)
```

RLS on every table: `user_id = auth.uid()` for select / insert / update / delete.

## 7. Still to do

**Time tracking**
1. **UAT until 31 Dec 2026**: use lula for time alongside Clockify; keep the portfolio filled from Clockify and re-run `npm run import-time` as needed.
2. **Cutover from Clockify** (January 2027): a final Clockify import, then lula becomes the only tracker.
3. **Portfolio copy** (with the cutover): a Supabase Edge Function copies each lula entry add, edit and delete to the portfolio's `time_entries`, one way, keeping lula's ids and sending the project name. Past rows are never rewritten. Needs 'lula' added to the portfolio's source check.
4. **Cleanup settings**: rename, merge and delete unused time tasks and tags; bulk-fix entries; define extra fields (and show them in the entry form).
5. **Pomodoro**: bare-bones, undecided whether a session saves an entry.
6. **Default project rules**: deferred.

**Later**
- Reminders and push notifications (Web Push + Edge Function + cron).
- Sharing or collaboration: not planned.

## 8. Open questions

- Pomodoro behaviour (board card fd164155).
