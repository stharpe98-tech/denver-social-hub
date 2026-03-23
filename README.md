# Denver Social Nights

Real small-group events across Denver. Built with **Astro SSR** on **Cloudflare Workers** + **D1**.

## Stack
- [Astro](https://astro.build) — SSR framework
- [Cloudflare Workers](https://workers.cloudflare.com) — edge runtime
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — SQLite database
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) — deploy CLI

## Dev
```bash
npm install
npm run dev
```

## Deploy
```bash
npm run deploy
```

## Structure
```
src/
  layouts/
    Base.astro        # Shared nav + global styles
  pages/
    index.astro       # Homepage hero
    discover.astro    # Browse events (/discover)
    events.astro      # Events list
    events/[id].astro # Event detail + RSVP
    members.astro     # The Crew (/members)
    fund.astro        # Spot a Stranger fund
    about.astro       # About / FAQ / Contact
    login.astro       # Join / Sign in
    profile.astro     # Member profile
    onboarding/
      1.astro         # Onboarding step 1
      done.astro      # Welcome screen
    api/              # API endpoints (TypeScript)
      rsvp.ts
      vote.ts
      rate.ts
      notify.ts
      logout.ts
      ...
  lib/
    db.ts             # D1 helper
    levels.ts         # Member level system
```

## Environment
Secrets set via `wrangler secret put`:
- `GROQ_API_KEY`
- `RESEND_API_KEY`
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
