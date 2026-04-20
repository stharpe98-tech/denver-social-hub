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
- **Spacing:** Strict 4px scale — only use `4, 8, 12, 16, 24, 32, 48, 64, 96` px for padding, margin, and gaps. Use the CSS variables (`--space-1` through `--space-9`) defined in `Base.astro` instead of raw pixel values.
- **Typography:** All `@font-face` declarations must use `font-display: swap` for performance.
- **Interactions:** Every `<button>` and `<a>` that looks like a button must have a `:hover` and `:active` state.
- **Process:** Always provide a "Plan" before writing any code.

## Design Direction
- **References:** Clean & Crisp light theme — Meetup backbone + Partiful social energy. White/light background, purple accent, community-voted feel.
- **Vibe:** Clean, modern, light. Trust signals and community voting front-and-center. Not corporate — still feels social and inviting.
- **Fonts:** Outfit (headings, weights 400-900) + Inter (body, weights 400-600). Loaded from Google Fonts.
- **Design tokens (in `src/layouts/Base.astro` `:root`):**
  - Background: `--bg: #FFFFFF`, `--surface: #F8F9FB`, `--surface-hover: #F0F2F5`
  - Borders: `--border: #E5E7EB`, `--border-hover: #D1D5DB`
  - Text: `--text: #111827`, `--text-sec: #6B7280`, `--text-faint: #9CA3AF`
  - Accent: `--accent: #7C3AED` (purple), `--accent2: #3B82F6` (blue), `--mint: #10B981` (green)
  - CTA: `--cta-bg: #7C3AED`, `--cta-text: #FFF`
  - Tags: `--tag-bg: #EEF2FF` / `--tag-text: #4338CA`, `--tag-bg2: #F0FDF4` / `--tag-text2: #047857`
  - Shadows: `--card-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
  - Radii: `--radius` (14), `--radius-lg` (20). Rounded pill buttons use `50px`.
  - Spacing: `--space-1` … `--space-9` (4/8/12/16/24/32/48/64/96).
- **Nav:** Light nav (white background, dark text) at top for desktop/tablet. Bottom tab bar for mobile with purple accent on active items.
- **Reusable patterns:**
  - `.btn-cta` — purple pill CTA with shadow. Primary CTA style.
  - `.btn-sec` — white pill with border. Secondary CTA style.
  - Card color-tinting via `--tint` CSS var on `.cat-pill` using `color-mix(in srgb, var(--tint) 6%, #fff)`.
  - Meetup-style `.categories-scroll` for horizontal category browsing (scroll-snap + hidden scrollbar).
  - Vote list (`.vi`) with progress bars and upvote buttons — community voting is the core differentiator.
  - Hero gradient: `linear-gradient(135deg, #F8F9FB, #EEF2FF, #F0FDF4)` — subtle, airy.

## Project-Specific Rules
- **SSR only** — never switch to static output.
- **Wrap every page in `<Base>`** — nav and global styles come from there.
- **DB access through `src/lib/db.ts`** — no raw D1 bindings in pages.
- **API routes are `.ts`** (not `.astro`) and live under `src/pages/api/`.
- **Secrets via Wrangler only** — never commit API keys.
