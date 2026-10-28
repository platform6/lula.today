---
description: Work the next To Do card on the lula board (or the card whose id you give)
argument-hint: "[card id]"
allowed-tools: Bash(npm run board *)
---

Work one card from the **lula** board, following the board rules in AGENTS.md.

1. Pick the card:
   - If an id was given (`$ARGUMENTS`), use that card. It must be in **To Do**; if it isn't, say where it is and stop.
   - Otherwise run `npm run board -- list lula "To Do"` and take the **top** card. If To Do is empty, say so and stop.
2. Run `npm run board -- show <id>` and read the title, notes and steps. Unchecked steps and the latest notes are
   usually the owner's feedback from testing.
3. If it's unclear what's wanted, ask the owner (or add a note with the question and leave the card in To Do). Don't guess.
4. Move it to **Doing**, build it, and run `npm run check` (typecheck, then tests); fix anything it reports.
5. Add a note to the card saying what changed (and anything left for the owner to check), then report back and ask
   whether to commit and push.
6. Once the owner says yes: follow `/cp` (commit with a `Card:` line, push, note the hash, move the card to **UAT**).
   Never move it to Done.
