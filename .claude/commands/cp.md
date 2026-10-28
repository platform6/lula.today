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
6. Note and move the cards from step 3, all of them in one call each:
   `npm run board -- note <id>,<id> "Committed in <short hash>."` then `npm run board -- move <id>,<id> UAT`.
   Never move anything to Done.
7. Report the commit hash and which cards moved.
