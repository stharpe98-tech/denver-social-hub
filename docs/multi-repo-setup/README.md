# Multi-Repo Setup

Reference materials for spinning up new app repos that live **outside** `denver-social-hub`. Each new app gets its own GitHub repo and its own Claude Code session.

## Why these files live here

This folder exists in `denver-social-hub` only because:

1. The branch `claude/setup-multiple-repos-UAMvU` was created for this work.
2. Claude Code's GitHub access in that session was scoped to `denver-social-hub`, so it couldn't push directly to the new repos.
3. These files are templates — copy them into the target repo, don't import them.

Once each app is set up, this folder can be deleted.

## Default stack for new apps

- **Frontend:** Next.js (App Router) + TypeScript
- **DB / Auth / Storage:** Supabase (Postgres)
- **Host:** Vercel (or Railway if the app needs cron / always-on workers)
- **Styling:** Tailwind CSS
- **Forms:** React Hook Form + Zod

`denver-social-hub` stays on Astro + Cloudflare Workers + D1 — do **not** migrate it.

## Workflow per new app

1. Create the empty repo on github.com (Private, Add README ✅, .gitignore: Node).
2. Clone it locally: `git clone https://github.com/stharpe98-tech/<repo>.git && cd <repo>`
3. Copy the matching `<repo>-CLAUDE.md` from this folder into the new repo as `CLAUDE.md`.
4. Commit it: `git add CLAUDE.md && git commit -m "add CLAUDE.md" && git push`
5. Run `claude` inside that folder.
6. Paste the matching `<repo>-starter-prompt.md` content as the first message.
7. Wait for the Plan, then say "go".

## Apps tracked here

| Repo | Status | Files |
|---|---|---|
| `quickbooks-mock` | Created on GitHub, awaiting setup | `quickbooks-mock-CLAUDE.md`, `quickbooks-mock-starter-prompt.md` |
| `event-app` | Not yet created | — |
| `web-starter` | Not yet created | — |
