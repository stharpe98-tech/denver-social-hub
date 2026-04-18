# Project Guide: Denver Social Nights (denver-social-hub)

## How I work with Claude
- **One source of truth:** this file. Both Cowork (chat) and Claude Code (desktop CLI) read it — never retype context between them.
- **Start any session with:** "Read CLAUDE.md, then [task]." That's it.
- **When something changes:** say "update CLAUDE.md with X" and commit. The other Claude picks it up next session.
- **Cowork (chat app):** planning, docs, GitHub, cross-project stuff.
- **Claude Code (desktop CLI):** building inside this repo.

## Commands
- Dev: `npm run dev`
- Deploy: `npm run deploy`
- Install: `npm install`
- Set secret: `wrangler secret put <NAME>`

## Tech Stack
- Framework: Astro (SSR, `output: 'server'`)
- Runtime: Cloudflare Workers (edge)
- Database: Cloudflare D1 (SQLite) — access via `src/lib/db.ts`
- Deploy: Wrangler CLI
- API routes: TypeScript under `src/pages/api/`
- Auth: Discord OAuth
- Email: Resend
- AI: Groq

## Required Secrets
- `GROQ_API_KEY`
- `RESEND_API_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`

## File Layout
- `src/layouts/Base.astro` — shared nav + global styles; wrap every page
- `src/pages/` — `.astro` routes (index, discover, events, events/[id], members, fund, about, login, profile, onboarding/)
- `src/pages/api/` — TypeScript endpoints (rsvp.ts, vote.ts, rate.ts, notify.ts, logout.ts)
- `src/lib/db.ts` — D1 helper (all DB access goes through this)
- `src/lib/levels.ts` — member level system

## Rules for "Perfection"
- **Mobile First:** Always design for small screens before desktop. Base styles target mobile; use `@media (min-width: ...)` to scale up.
- **Visuals:** Use 60-30-10 color rule (Primary/Secondary/Accent). Define the three colors as CSS custom properties in `Base.astro` and reference them everywhere — no one-off hex codes in components.
- **Spacing:** Strict 4px scale — only use `4, 8, 12, 16, 24, 32, 48, 64, 96` px for padding, margin, and gaps. Define these as CSS variables (`--space-1` through `--space-8`) in `Base.astro` and use the variables instead of raw pixel values.
- **Typography:** All `@font-face` declarations must use `font-display: swap` for performance.
- **Interactions:** Every `<button>` and `<a>` that looks like a button must have a `:hover` and `:active` state.
- **Process:** Always provide a "Plan" before writing any code.

## Project-Specific Rules
- **SSR only** — never switch to static output.
- **Wrap every page in `<Base>`** — nav and global styles come from there.
- **DB access through `src/lib/db.ts`** — no raw D1 bindings in pages.
- **API routes are `.ts`** (not `.astro`) and live under `src/pages/api/`.
- **Secrets via Wrangler only** — never commit API keys.
