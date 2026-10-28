# lula.today

Offline-first task and kanban PWA: React + Vite + Tailwind, Dexie (IndexedDB) synced to Supabase.
Run `npm run check` (typecheck, then tests; it exits non-zero if either fails) before calling a change done.

These instructions are for any coding agent (Codex reads this file; Claude Code reads it through
CLAUDE.md).

## Working from the lula board

App ideas live as cards on the **lula** project's board in the app itself. Use the board
script to read and update them (it signs in as the owner; see `scripts/session.ts`):

```
npm run board -- list lula            # cards by column, with ids
npm run board -- show <id>            # notes, steps, files, details, commits
npm run board -- files <id> [folder]  # download the card's attached files (temp folder by default)
npm run board -- move <id> Doing
npm run board -- note <id> "<text>"   # add --by <name> to sign the note, e.g. --by Codex
npm run board -- step <id> "<text>" ["<text>"...]   # add checklist steps
npm run board -- help                 # everything else
```

`move`, `note` and `show` take several ids at once, comma-separated (`a1b2c3d4,e5f6a7b8`); every id is
checked before anything changes. For long or multi-line text, `note` and `step` read `--file <path>`
(`-` for stdin; for `step`, one step per line) instead of quoting it on the command line. `list`,
`show` and `add` print JSON with `--json`.

It needs network access and the owner's login in `.env.local` (gitignored, on the owner's
computer only). If it can't sign in or reach Supabase, say so rather than working around it.

Rules for the board:

- Only take cards in **To Do**. Ideas and other columns are the owner's scratchpad; leave them alone.
- Move a card to **Doing** when starting it.
- When it's built and checked, add a note saying what changed. Commit and push only when the
  owner says to.
- Once it's pushed, add a note with the commit and move the card to **UAT**, where the owner
  tests it. Never move cards to **Done**; that is the owner's call after testing.
- If a card is unclear, add a note with the question and leave it in To Do rather than guessing.
- If another agent may be working the board too, only take the card you were given by id.

### "Work the next card" (or "work card <id>")

1. Pick the card: the one whose id was given (it must be in To Do; if not, say where it is and
   stop), otherwise the **top** card from `npm run board -- list lula "To Do"`. If To Do is empty,
   say so and stop.
2. `npm run board -- show <id>`: read the title, notes and steps. Unchecked steps and the latest
   notes are usually the owner's feedback from testing.
3. If it's unclear what's wanted, ask (or note the question on the card and leave it in To Do).
4. Move it to Doing, build it, and run `npm run check`.
5. Note on the card what changed and anything left for the owner to check, then report back and
   ask whether to commit and push.

### "Commit and push" (or "cp")

Saying this is the owner's go-ahead to commit and push what's in the working tree.

1. `git status` and `git diff`; if there's nothing to commit, say so and stop.
2. Run `npm run check` on its own and read the result; if it fails, report it and stop. Don't chain
   the commit or push onto a command whose failure wouldn't stop them.
3. Work out which cards in Doing the commit completes. Leave cards still in progress out.
4. Commit in this repo's style: a short summary line, then `-` bullets for each change, then a
   `Card: <8-character id>` line per card from step 3 (`board show` lists a card's commits from
   these). Never stage `.env.local`, `.board-session.local` or `.claude/settings.local.json`.
5. Push to the current branch.
6. Note `Committed in <short hash>.` on those cards and move them to UAT (comma-separated ids,
   one call each).
7. Report the commit hash and which cards moved.

## Database changes

Schema changes are SQL files in `supabase/migrations/` named `<YYYYMMDDHHMMSS>_<name>.sql`.
The timestamp must match the version recorded in `supabase_migrations.schema_migrations`.
Preserve existing migration versions.

Deploying does not apply migrations: Netlify only runs `npm run build`, and the repo has no
linked Supabase CLI project. Apply each new migration yourself, either with the Supabase MCP
`apply_migration` tool (which records the version) or by running the SQL in the dashboard and
inserting its version and name into `supabase_migrations.schema_migrations`. Then rename the
local file if needed so its timestamp matches the recorded version. A new column must be live on
Supabase before app code that writes it is deployed, or every sync of that table fails.
