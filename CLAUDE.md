@AGENTS.md

## Claude Code

`/next-card [id]` runs "work the next card" and `/cp` runs "commit and push" from AGENTS.md
(see `.claude/commands/`). Sign board notes as Claude (the default).

The Supabase MCP connector is signed into one of the owner's two Supabase accounts at a time. lula
(project `lula`, ref `hobsxhmxjxyhzyoyoufj`) lives in the **"dinner"** org; the personal account's
org is "starbucket". Before Supabase MCP work, check `list_organizations` shows "dinner"; if it shows
"starbucket", ask the owner to reconnect it with `/mcp`.
