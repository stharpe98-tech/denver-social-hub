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
  DISCORD_BOT_TOKEN?: string;
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

// Day-before reminders for /events (separate from potlucks). Events
// store dates as ("MAY", "16") strings, so we have to translate
// tomorrow's calendar date into that shape and match by month+day.
async function sendEventReminders(env: Env): Promise<{ sent: number; errors: number; skipped: string | null }> {
  const db = env.DB;
  if (!db) return { sent: 0, errors: 0, skipped: 'no_db' };

  const cfgRows = await db.prepare("SELECT key, value FROM config").all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  if (!cfg.resend_api_key) return { sent: 0, errors: 0, skipped: 'no_resend_key' };

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const evMonth = MONTHS[tomorrow.getUTCMonth()];
  const evDay = String(tomorrow.getUTCDate());

  const siteUrl = cfg.site_url || 'https://denversocialhub.com';
  const fromEmail = cfg.from_email || 'Denver Social <noreply@denversocialhub.com>';

  // Make sure the new columns exist before we query them
  try {
    const cols = await db.prepare("PRAGMA table_info(event_rsvps)").all();
    const names = new Set((cols.results ?? []).map((r: any) => r.name));
    if (!names.has('reminder_sent_at')) {
      await db.prepare("ALTER TABLE event_rsvps ADD COLUMN reminder_sent_at TEXT").run();
    }
  } catch {}

  const { results } = await db.prepare(`
    SELECT r.id, r.member_name, r.member_email, r.bringing, r.checkin_token,
           e.id as event_id, e.title, e.event_month, e.event_day, e.location, e.zone
    FROM event_rsvps r
    JOIN events e ON e.id = r.event_id
    WHERE UPPER(e.event_month) = ?
      AND CAST(e.event_day AS INTEGER) = CAST(? AS INTEGER)
      AND (r.status IS NULL OR r.status = 'going')
      AND r.waitlist_position IS NULL
      AND r.member_email IS NOT NULL AND r.member_email != ''
      AND r.member_email NOT LIKE '%@reddit.local'
      AND r.member_email NOT LIKE '%@discord.local'
      AND r.reminder_sent_at IS NULL
  `).bind(evMonth, evDay).all();

  let sent = 0;
  let errors = 0;
  for (const row of (results ?? []) as any[]) {
    try {
      const name = (row.member_name || '').split(' ')[0] || 'friend';
      const where = row.location || row.zone || 'Denver';
      const qrUrl = row.checkin_token ? `${siteUrl}/checkin/${row.checkin_token}` : null;
      const html = `<!DOCTYPE html><html><body style="margin:0;background:#FFFCF7;font-family:'Inter',sans-serif;color:#1F1A14;">
        <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
          <tr><td align="center">
          <table width="100%" style="max-width:520px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #F0E5D1;box-shadow:0 4px 16px rgba(0,0,0,0.04);">
            <tr><td style="background:linear-gradient(135deg,#F97316,#EC4899);padding:28px 24px;text-align:center;color:#fff;">
              <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.9;margin-bottom:8px;">Tomorrow at Denver Social</div>
              <div style="font-family:'Outfit',sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.02em;">${escapeHtml(row.title || 'Your event')}</div>
            </td></tr>
            <tr><td style="padding:24px 28px;">
              <p style="font-size:16px;line-height:1.55;color:#1F1A14;margin:0 0 12px;">Hey ${escapeHtml(name)},</p>
              <p style="font-size:15px;line-height:1.6;color:#6B5F4D;margin:0 0 18px;">Just a heads-up — <strong style="color:#1F1A14">${escapeHtml(row.title || '')}</strong> is tomorrow (${escapeHtml(row.event_month || '')} ${escapeHtml(row.event_day || '')}) at <strong style="color:#1F1A14">${escapeHtml(where)}</strong>. We're glad you're coming.</p>
              ${row.bringing ? `<p style="font-size:14px;color:#6B5F4D;margin:0 0 18px;padding:10px 14px;background:#FFF6E9;border-radius:10px;"><strong>Bringing:</strong> ${escapeHtml(row.bringing)}</p>` : ''}
              ${qrUrl ? `<p style="font-size:13px;color:#6B5F4D;margin:0 0 18px;line-height:1.55;">Show this when you arrive (one-tap check-in):<br/><a href="${qrUrl}" style="display:inline-block;margin-top:10px;padding:10px 18px;background:#F97316;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:13px;">Check in →</a></p>` : ''}
              <div style="text-align:center;margin-top:20px;">
                <a href="${siteUrl}/events/${row.event_id}" style="display:inline-block;padding:12px 24px;background:#0EA5E9;color:#fff;border-radius:999px;text-decoration:none;font-weight:700;font-size:14px;">Open event page</a>
              </div>
            </td></tr>
            <tr><td style="background:#FFF6E9;padding:14px 24px;text-align:center;border-top:1px solid #F0E5D1;font-size:11px;color:#A8997F;">
              Can't make it? Cancel on the <a href="${siteUrl}/events/${row.event_id}" style="color:#6B5F4D;text-decoration:underline;">event page</a> so someone on the waitlist can take your spot.
            </td></tr>
          </table>
          </td></tr>
        </table>
      </body></html>`;
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [row.member_email],
          subject: `Tomorrow: ${row.title}`,
          html,
        }),
      });
      if (!resp.ok) { errors++; continue; }
      await db.prepare("UPDATE event_rsvps SET reminder_sent_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), row.id).run();
      sent++;
    } catch { errors++; }
  }
  return { sent, errors, skipped: null };
}

// Weekly digest — runs only on Friday (UTC). Pulls up to 6 upcoming
// events from the next 7 days, fans out an email to every member with
// a real email, and records last_digest_sent_at in config so we never
// double-send within the same week.
async function sendWeeklyDigest(env: Env): Promise<{ sent: number; errors: number; skipped: string | null }> {
  const db = env.DB;
  if (!db) return { sent: 0, errors: 0, skipped: 'no_db' };

  const cfgRows = await db.prepare("SELECT key, value FROM config").all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  if (!cfg.resend_api_key) return { sent: 0, errors: 0, skipped: 'no_resend_key' };

  const now = new Date();
  if (now.getUTCDay() !== 5) return { sent: 0, errors: 0, skipped: 'not_friday' };
  const todayISO = now.toISOString().slice(0, 10);
  if ((cfg.last_digest_sent_at || '').slice(0, 10) === todayISO) {
    return { sent: 0, errors: 0, skipped: 'already_sent_today' };
  }

  const siteUrl = cfg.site_url || 'https://denversocialhub.com';
  const fromEmail = cfg.from_email || 'Denver Social <noreply@denversocialhub.com>';

  // Pull upcoming events. The events table uses event_month / event_day
  // strings, so we lean on `is_past` and `rsvp_count <= spots` instead
  // of date math to keep this small + readable.
  const evRows = await db.prepare(
    "SELECT id, title, event_type, event_month, event_day, zone, location, rsvp_count, spots FROM events WHERE (is_past IS NULL OR is_past = 0) ORDER BY id DESC LIMIT 6"
  ).all();
  const events = (evRows.results ?? []) as any[];
  if (events.length === 0) return { sent: 0, errors: 0, skipped: 'no_events' };

  // Don't bother flooding inboxes with single-event digests — they
  // already get reminders for those.
  const memberRows = await db.prepare(
    "SELECT email, name FROM members WHERE email IS NOT NULL AND email != '' AND email NOT LIKE '%@reddit.local' AND email NOT LIKE '%@discord.local' LIMIT 500"
  ).all();
  const members = (memberRows.results ?? []) as any[];
  if (members.length === 0) return { sent: 0, errors: 0, skipped: 'no_members' };

  const eventHtml = events.map((e) => {
    const meta = [`${e.event_month || ''} ${e.event_day || ''}`.trim(), e.zone || e.location || 'Denver'].filter(Boolean).join(' · ');
    const seats = e.spots ? ` · ${e.rsvp_count || 0}/${e.spots} going` : '';
    return `
      <tr><td style="padding:12px 0;border-bottom:1px solid #e5e7eb;">
        <a href="${siteUrl}/events/${e.id}" style="font-weight:600;font-size:15px;color:#0EA5E9;text-decoration:none;">${escapeHtml(e.title || 'Untitled event')}</a>
        <div style="font-size:13px;color:#6b7280;margin-top:2px;">${escapeHtml(meta)}${seats}</div>
      </td></tr>`;
  }).join('');

  let sent = 0;
  let errors = 0;
  for (const m of members) {
    try {
      const firstName = (m.name || 'friend').split(' ')[0];
      const html = `<!DOCTYPE html><html><body style="margin:0;background:#f7f5f2;font-family:'Inter',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;padding:32px 16px;">
          <tr><td align="center">
          <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06);">
            <tr><td style="background:linear-gradient(135deg,#0EA5E9,#10B981);padding:28px 24px;text-align:center;color:#fff;">
              <div style="font-size:13px;font-weight:600;opacity:0.85;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;">This week in Denver Social</div>
              <div style="font-size:24px;font-weight:800;">Happening this week, ${escapeHtml(firstName)}.</div>
            </td></tr>
            <tr><td style="padding:8px 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">${eventHtml}</table>
              <div style="text-align:center;margin-top:20px;">
                <a href="${siteUrl}/events" style="display:inline-block;background:#0EA5E9;color:#fff;padding:12px 24px;border-radius:50px;text-decoration:none;font-weight:600;font-size:14px;">See all events</a>
              </div>
            </td></tr>
            <tr><td style="background:#f7f5f2;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;">
              Denver Social · No ads, ever. <a href="${siteUrl}/me" style="color:#6b7280;text-decoration:underline;">Manage your account</a>
            </td></tr>
          </table>
          </td></tr>
        </table>
      </body></html>`;
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: [m.email],
          subject: `This week in Denver Social — ${events.length} ${events.length === 1 ? 'event' : 'events'}`,
          html,
        }),
      });
      if (!resp.ok) { errors++; continue; }
      sent++;
    } catch { errors++; }
  }

  await db.prepare("INSERT OR REPLACE INTO config (key, value) VALUES ('last_digest_sent_at', ?)")
    .bind(now.toISOString()).run();

  return { sent, errors, skipped: null };
}

function escapeHtml(s: string): string {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] as string));
}

export default {
  fetch: (astroWorker as any).fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Two crons share this handler — branch on the pattern so we don't
    // try to send 96 daily emails or sync events once a day.
    const cron = (event as any).cron as string | undefined;
    const isSync = cron === '*/15 * * * *';

    if (isSync) {
      ctx.waitUntil(
        runAllSyncs(env.DB, env.DISCORD_BOT_TOKEN).then((r) => {
          console.log(`[sync] inserted=${r.total.inserted} updated=${r.total.updated} errors=${r.total.errors}`);
        }).catch((e) => {
          console.error('[sync] failed', e);
        }),
      );
      return;
    }

    // Default = daily reminder cron (0 14 * * *)
    ctx.waitUntil(
      sendReminders(env).then((r) => {
        console.log(`[reminders] sent=${r.sent} errors=${r.errors} skipped=${r.skipped ?? 'none'}`);
      }).catch((e) => {
        console.error('[reminders] failed', e);
      }),
    );
    ctx.waitUntil(
      sendEventReminders(env).then((r) => {
        console.log(`[event-reminders] sent=${r.sent} errors=${r.errors} skipped=${r.skipped ?? 'none'}`);
      }).catch((e) => {
        console.error('[event-reminders] failed', e);
      }),
    );
    ctx.waitUntil(
      sendWeeklyDigest(env).then((r) => {
        console.log(`[digest] sent=${r.sent} errors=${r.errors} skipped=${r.skipped ?? 'none'}`);
      }).catch((e) => {
        console.error('[digest] failed', e);
      }),
    );
  },
};
