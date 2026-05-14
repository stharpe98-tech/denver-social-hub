// Wrapper around Astro's generated Cloudflare worker.
// Adds a scheduled() handler for the daily reminder cron while delegating
// fetch() to the Astro-built worker. Built artifact lives at ../worker/index.js
// after `npm run build` runs (astro build && mv dist/_worker.js worker).
//
// @ts-ignore — generated at build time, no types
import astroWorker from '../worker/index.js';
import { buildReminderEmail } from '../src/lib/email';
import { ensurePotluckSchema } from '../src/lib/potluck-schema';
import { runAllSyncs } from '../src/lib/event-sync';

interface Env {
  DB: D1Database;
  [key: string]: unknown;
}

async function sendReminders(env: Env): Promise<{ sent: number; errors: number; skipped: string | null }> {
  const db = env.DB;
  if (!db) return { sent: 0, errors: 0, skipped: 'no_db' };
  await ensurePotluckSchema(db);

  const cfgRows = await db.prepare("SELECT key, value FROM config").all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });

  if (!cfg.resend_api_key) return { sent: 0, errors: 0, skipped: 'no_resend_key' };

  // Tomorrow in YYYY-MM-DD (UTC). Cron runs at 14:00 UTC = 8am MT, so "tomorrow"
  // is consistent regardless of TZ for events stored as date-only.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const siteUrl = cfg.site_url || 'https://denversocialhub.com';
  const fromEmail = cfg.from_email || 'Denver Social <noreply@denversocialhub.com>';

  const { results } = await db.prepare(`
    SELECT r.id, r.name, r.email, r.dish, r.cancel_token,
           p.title, p.date_label, p.time_label, p.location, p.location_detail
    FROM potluck_rsvp r
    JOIN potlucks p ON p.id = r.potluck_id
    WHERE p.event_date = ?
      AND r.rsvp = 'yes'
      AND r.email IS NOT NULL AND r.email != ''
      AND r.reminder_sent_at IS NULL
  `).bind(tomorrow).all();

  let sent = 0;
  let errors = 0;
  for (const row of (results ?? []) as any[]) {
    try {
      const editUrl = `${siteUrl}/potlucks/edit?token=${row.cancel_token}`;
      const html = buildReminderEmail({
        name: row.name || '',
        eventTitle: row.title || '',
        eventDate: row.date_label || '',
        eventTime: row.time_label || '',
        eventLocation: row.location || '',
        eventLocationDetail: row.location_detail || '',
        dish: row.dish || '',
        editUrl,
      });
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.resend_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [row.email],
          subject: `Tomorrow: ${row.title}`,
          html,
        }),
      });
      if (!resp.ok) {
        errors++;
        continue;
      }
      await db.prepare("UPDATE potluck_rsvp SET reminder_sent_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), row.id)
        .run();
      sent++;
    } catch {
      errors++;
    }
  }
  return { sent, errors, skipped: null };
}

async function runEventSync(env: Env): Promise<void> {
  const db = env.DB;
  if (!db) { console.log('[sync] skipped: no DB'); return; }
  try {
    const botToken = (env as any).DISCORD_BOT_TOKEN as string | undefined;
    const r = await runAllSyncs(db, botToken);
    console.log(`[sync] inserted=${r.total.inserted} updated=${r.total.updated} errors=${r.total.errors}`);
  } catch (e) {
    console.error('[sync] failed', e);
  }
}

export default {
  fetch: (astroWorker as any).fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // The daily reminder cron is "0 14 * * *". Any other cron is the 2-hour
    // sync schedule. Branch so we don't email reminders 12x/day.
    if (event.cron === '0 14 * * *') {
      ctx.waitUntil(
        sendReminders(env).then((r) => {
          console.log(`[reminders] sent=${r.sent} errors=${r.errors} skipped=${r.skipped ?? 'none'}`);
        }).catch((e) => {
          console.error('[reminders] failed', e);
        }),
      );
    } else {
      ctx.waitUntil(runEventSync(env));
    }
  },
};
