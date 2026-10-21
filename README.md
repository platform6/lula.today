# lula.today

Personal, offline-first task manager (Areas → Projects → Tasks → Steps) with per-project kanban boards. Installable PWA for iPhone; Supabase for auth and sync; hosted on Netlify.

See [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) for scope and design.

## Develop

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest + fake IndexedDB)
npm run build      # type-check + production build into dist/
npm run icons      # regenerate PWA icons from public/favicon.svg
```

`.env` holds the Supabase URL and publishable key (public by design; RLS protects data).

## How it fits together

| Path | Role |
|---|---|
| `src/db/db.ts` | Dexie (IndexedDB) schema: local copy of every table + `outbox` + `meta` |
| `src/db/mutate.ts` | All local writes; each one also queues an outbox entry in the same transaction |
| `src/db/actions.ts` | Domain operations (create/move/complete/archive, column rules, Inbox bootstrap) |
| `src/sync/engine.ts` | Push outbox → Supabase upserts; pull rows by server `updated_at` cursor |
| `src/auth/AuthProvider.tsx` | Supabase email/password session; cached user so the app opens offline |
| `src/pages/*` | Today, Inbox, Board, Projects, All tasks, Search (MiniSearch, on-device), Archive, Settings |
| `supabase/migrations/` | Postgres schema, RLS, `updated_at` triggers, nightly auto-archive cron |

Conflicts resolve last-synced-write-wins per row. Deletes are soft (`deleted_at`) so they propagate.

## Experience lists

Lists is a standalone section below Realms in the desktop sidebar and a separate mobile tab.
It starts empty. Create General, Video games, Concerts, or Television lists, then add entries
with optional dates, ratings, notes, links, and category-specific details. Entries are separate
from tasks and can be searched within their list. Lists can be renamed; their category stays
fixed to preserve the entry fields. Deleting a list also soft-deletes its entries.

The Lists migration is `supabase/migrations/20261021143600_experience_lists.sql`. It creates
owner-protected `lists` and `list_items` tables with realtime sync. Apply it through the
Supabase migration workflow before deploying app code that uses the tables. If the SQL was
already applied manually, mark this version as applied in migration history instead of
executing its table-creation SQL again. Local filename versions must match remote history.
