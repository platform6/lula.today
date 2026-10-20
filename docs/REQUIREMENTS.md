# Listing Things, Living Life — Requirements & Scope

_Status: draft v2 · 2026-10-20_

A personal, offline-first task manager installed as a PWA on iPhone and usable from a work browser. Single user (me). Optimized for **fast capture** of things I need to do, organized into areas → projects → kanban boards. Not a team/Jira-style tool.

---

## 1. Decisions so far

| Topic | Decision |
|---|---|
| Users | Single user. No assignees, sharing, or invites. Public sign-ups disabled. |
| Auth | Supabase Auth, email + password. |
| Primary device | iPhone (installed to Home Screen) + desktop browser at work. |
| Offline | **Full offline read/write is required**, with sync when back online. |
| Backend | New, dedicated Supabase project. |
| Kanban columns | Configurable **per project** via a settings screen. |
| Search | MVP requirement. Must work offline. |
| Theme | Dark mode by default. |
| Task fields | Includes an optional URL. |
| Hierarchy | Areas → Projects → Tasks → Steps (subtasks). |
| Archiving | Completed tasks auto-archive 7 days after completion; archived tasks are kept indefinitely. |
| Hosting | Netlify, custom domain `lula.today` (registered through Netlify; DNS managed by Netlify). |
| Supabase project | `lula` (ref `hobsxhmxjxyhzyoyoufj`), org `dinner`, region `us-east-1`. |

## 2. Tech stack

- **React + Vite + TypeScript** (client-only SPA)
- **vite-plugin-pwa** (Workbox) — manifest, precached app shell, installability
- **Tailwind CSS** — dark-first theme
- **Dexie (IndexedDB)** — local database; the UI reads and writes here
- **Custom sync engine** — outbox push + incremental pull against Supabase (see §5)
- **dnd-kit** — touch-friendly drag & drop for kanban
- **MiniSearch** — client-side full-text search over the local DB
- **fractional-indexing** — conflict-friendly ordering of cards and columns
- **Supabase** — Auth + Postgres + Row Level Security
- **Hosting** — Netlify (static deploy, HTTPS, SPA redirect rule)

## 3. Functional requirements (MVP)

### 3.1 Authentication
- Sign in with email + password; sign out.
- Session persists across app launches; app opens **offline** with the cached session without forcing re-login.
- Password reset via email.
- Sign-ups disabled in Supabase; the single account is created by hand.

### 3.2 Organization

The model: **Inbox → Area → Project**. Everything is captured into the Inbox, then sorted into an area (the kind of work, ongoing) and optionally a project (a finite effort within that area).

```
Inbox                      capture only; sorted out of, never worked in
Area: Home                 ongoing; never "done"
 ├─ (area tasks)           tasks that belong to the area but no project
 ├─ Project: Garage clean-out
 └─ Project: Kitchen reno  finite; completed and archived when finished
```

**Inbox**
- Built-in, one per user. It's the only capture destination for the global **+** button.
- Shown as a **list, not a board**. Each task has a primary **Move to…** action: pick an area, then (optionally) a project in it.
- **Sort mode**: steps through Inbox tasks one at a time with large targets: each area, that area's projects, "Do today" (sets the due date to today), Delete, and Skip.
- An Inbox count badge on the nav tab, and a "N tasks to sort" prompt on Today. Empty state reads as "Inbox zero."

**Areas**
- e.g. Work, Home, Health: name, color, icon, sort order. Create / rename / reorder / archive. Areas have no completion state.
- Every area has a **built-in area-tasks list** for tasks that belong to the area but not to a project. It is implemented as a hidden project flagged `is_area_default` (one per area, created with the area). The UI never calls it a project: it appears as the area's own task list.
- The area page shows the area's tasks first, then its projects.

**Projects**
- **Every project belongs to an area.** Projects are created from within an area; "No area" no longer exists. Existing projects without an area get a one-time prompt to choose one.
- Name, description, optional due date, status (active / completed / archived). Colors are taken from the area so families read together.
- Projects show progress ("6 of 10 done") and a **Complete project** action that archives it. Areas show neither.

**Wayfinding**
- Breadcrumbs everywhere a task or board appears: **Work › Website redesign**, or **Work** alone for area tasks.
- The mobile tab bar reads Today · Inbox · Areas · Search · Settings.

### 3.3 Tasks
| Field | Required | Notes |
|---|---|---|
| Title | ✓ | Title-cased on save (also steps); words you capitalized, links, emails and numbers are left alone |
| Notes | | Plain text / light markdown |
| URL | | Optional link, opens in a new tab |
| Project | ✓ | Inbox on capture; an area's built-in task list for area-only tasks |
| Column | ✓ | Defaults to the project's first column |
| Priority | | None / Low / Medium / High |
| Due date | | Date, optional time |
| Tags | | Many-to-many (stored as `labels`) |
| Steps | | Ordered subtasks: text, done state |
| Completed at | | Set automatically when moved into a "done" column |

- **Quick add**: the always-visible "+" captures a title in one step (Enter to save, then the panel closes) and **always saves to the Inbox**, whatever page you're on. Optional fast fields: due date and priority. "Add task" inside a project's column saves directly to that column.
- Edit in a detail sheet (bottom sheet on mobile, side panel on desktop).
- Steps can be added, checked off, reordered, and deleted inline in the detail sheet.
- Archive and delete (soft delete, see §5).

#### Archiving
- A task is **completed** when moved into a "done" column (`completed_at` set); moving it out clears `completed_at`.
- Completed tasks **auto-archive 7 days after `completed_at`**. A nightly `pg_cron` job on Supabase sets `archived_at`, and that change syncs down like any other edit. The client also hides tasks past the 7-day mark on its own, so this works offline too.
- Tasks can also be archived manually at any time.
- Archived tasks are **retained indefinitely**, viewable in an Archive screen (filter by area/project), searchable, and restorable.

### 3.4 Kanban board (per project)
- Columns rendered horizontally; swipe/scroll on mobile.
- Drag cards between columns and reorder within a column (touch + mouse).
- Cards show title, priority, due date, labels, steps progress (e.g. 2/5), and a link icon if a URL is set.
- Optional "hide completed" toggle.

### 3.5 Project settings — columns
- Add, rename, reorder, and delete columns per project.
- Mark exactly one or more columns as **"done"** (drives completion status and filtering).
- Deleting a non-empty column requires choosing a column to move its tasks to.
- New projects get columns from a **default template** (editable in global settings; initial: Backlog · To Do · Doing · Done).

### 3.6 Cross-project views
- **Today / Upcoming**: tasks due today, overdue, and in the next 7 days.
- **All tasks** list with filters: area, project, label, priority, due range, done/not done.

### 3.7 Search
- Global search (shortcut `/` on desktop; search bar on mobile).
- Searches task title, notes, URL, steps, labels, and project/area names.
- Includes archived tasks, shown in a separate, de-emphasized group.
- Runs entirely on-device, so it works offline; results update as you type.

### 3.8 Settings
- Default column template.
- Theme (dark default, light optional).
- Sync status: last synced time, pending changes count, "sync now".
- Account: change password, sign out.

## 4. Non-functional requirements

- **Offline-first**: every MVP feature works without a network connection.
- **Performance**: interactions update immediately from the local DB; no waiting on network.
- **Mobile-first UI**: one-handed use, safe-area insets for iPhone notch/home indicator, 44px+ touch targets.
- **Security**: RLS on every table restricting rows to `auth.uid()`; only the anon/publishable key ships to the client.
- **Data durability**: request persistent storage (`navigator.storage.persist()`); the server is the durable backup.
- **Accessibility**: keyboard navigable on desktop, sufficient contrast in dark mode.

## 5. Offline & sync design

**Model:** the local Dexie DB is the source of truth for the UI. Supabase is the sync target and backup.

- **Client-generated UUIDs** for all rows, so records can be created offline.
- **Writes**: each local write updates Dexie and appends to an **outbox** table in the same transaction.
- **Push**: the outbox is flushed in order via upserts when online. Retries with backoff; idempotent.
- **Pull**: fetch rows where server `updated_at > last_pulled_at` (minus a small overlap window), upsert into Dexie.
- **Server timestamps**: a Postgres trigger sets `updated_at = now()` on every insert/update, so pull cursors don't depend on device clocks.
- **Deletes**: soft deletes (`deleted_at`) so deletions propagate; purge later.
- **Conflicts**: last-write-wins per row. This is acceptable for a single user on two devices.
- **Ordering**: fractional index strings for `position`, so moving one card rewrites only that card.
- **Triggers to sync**: app launch, app returning to foreground, `online` event, after local writes (debounced), and a manual "sync now". iOS has no Background Sync API, so sync only runs while the app is open.

**iOS caveats to design around**
- The Home Screen PWA has its **own storage, separate from Safari**. Log in inside the installed app.
- Safari can evict storage for sites not installed to the Home Screen. Installed PWAs are far safer, but the server copy is still the real backup.
- Push notifications only work for installed PWAs on iOS 16.4+ (relevant for a later reminders phase).

## 6. Data model (Postgres; mirrored in Dexie)

All tables include `id uuid pk`, `user_id uuid` (default `auth.uid()`), `created_at`, `updated_at` (trigger), and `deleted_at`.

```
areas            name, color, icon, position
projects         area_id?, name, color, description, due_date?, is_inbox, archived_at?, position
board_columns    project_id, name, is_done, position
tasks            project_id, column_id, title, notes?, url?, priority, due_at?, completed_at?, archived_at?, position
steps            task_id, text, is_done, position
labels           name, color
task_labels      task_id, label_id                        (composite pk)
settings         one row per user: default_columns jsonb, theme
```

RLS on every table: `user_id = auth.uid()` for select / insert / update / delete.

## 7. Out of scope for MVP (later phases)

1. Reminders and push notifications (Web Push + Supabase Edge Function + cron)
2. Recurring tasks
3. Calendar view
4. Attachments (Supabase Storage)
5. Data export / import (JSON)
6. Sharing or collaboration (explicitly not planned)

## 8. Open questions

- None currently.
