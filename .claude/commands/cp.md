---
description: Commit and push the current work, then move its lula cards to UAT
allowed-tools: Bash(git *), Bash(npm run *)
---

Typing this command is the owner's go-ahead to commit and push what's in the working tree now.

1. Run `git status` and `git diff`. If there's nothing to commit, say so and stop.
2. Run `npm run check` (typecheck, then tests) as a command of its own, and read its result before going on. If it
   fails, report the failure and stop without committing. Never chain `git commit` or `git push` onto a command
   whose failure wouldn't stop them.
3. Work out which cards on the lula board in **Doing** this commit completes (check with
   `npm run board -- list lula Doing` and the cards' notes). Leave cards that are still in progress out.
4. Stage the changes and commit with a message in this repo's style (a short summary line, then `-` bullets
   for each change), then a `Card: <8-character id>` line for each card from step 3, then the attribution lines
   the session gives for commits. Never stage secrets: `.env.local`, `.board-session.local` and
   `.claude/settings.local.json` are gitignored and must stay out.
5. Push to the current branch.
6. Note, add test steps to, and move the cards from step 3:
   - `npm run board -- note <id>,<id> "Committed in <short hash>."` (all cards in one call).
   - For each card, add UAT checklist steps for the owner: `npm run board -- step <id> "Test: ..." "Test: ..."`
     (or `--file <path>`, one step per line). One step per behaviour to check, each starting with `Test:` and
     saying what to do and what should happen, e.g. `Test: In Time > Report, tap a day's bar; that day's
     entries list under the chart`. Cover the edge cases the change touches, not only the main path.
   - `npm run board -- move <id>,<id> UAT` (all cards in one call). Never move anything to Done.
7. Report the commit hash, which cards moved, and the test steps added to each.
