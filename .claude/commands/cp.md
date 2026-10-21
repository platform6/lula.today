---
description: Commit and push the current work, then move its lula cards to UAT
allowed-tools: Bash(git *), Bash(npm run *)
---

Typing this command is the owner's go-ahead to commit and push what's in the working tree now.

1. Run `git status` and `git diff`. If there's nothing to commit, say so and stop.
2. Run `npm run typecheck` and `npm test`. If either fails, report it and stop without committing.
3. Stage the changes and commit with a message in this repo's style (a short summary line, then `-` bullets
   for each change), ending with the attribution lines the session gives for commits. Never stage secrets:
   `.env.local`, `.board-session.local` and `.claude/settings.local.json` are gitignored and must stay out.
4. Push to the current branch.
5. For each card on the lula board in **Doing** that this commit completes (check with
   `npm run board -- list lula Doing` and the cards' notes): add a note `Committed in <short hash>.` and move it
   to **UAT**. Leave cards that are still in progress where they are, and never move anything to Done.
6. Report the commit hash and which cards moved.
