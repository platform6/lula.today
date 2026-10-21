# lula.today

Offline-first task and kanban PWA: React + Vite + Tailwind, Dexie (IndexedDB) synced to Supabase.
Run `npm run typecheck` and `npm test` before calling a change done.

## Working from the lula board

App ideas live as cards on the **lula** project's board in the app itself. Use the board
script to read and update them (it signs in as the owner; see the header of `scripts/board.ts`):

```
npm run board -- list lula            # cards by column, with ids
npm run board -- show <id>            # notes, steps, details
npm run board -- move <id> Doing
npm run board -- note <id> "<text>"
```

When asked to work the board:

- Only take cards in **To Do**. Ideas and other columns are the owner's scratchpad; leave them alone.
- Move a card to **Doing** when starting it.
- When it's built and checked, add a note saying what changed, and move it to **Done** only
  once it's committed. Commit and push only when the owner says to, as usual.
- If a card is unclear, add a note with the question and leave it in To Do rather than guessing.
