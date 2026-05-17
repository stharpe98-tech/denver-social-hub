import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { canEditProfile } from '../../../lib/profile-auth';
import { ensureBookingsSchema, formatDenverHuman } from '../../../lib/bookings-schema';

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function htmlPage(title: string, bodyHtml: string): Response {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#F8F9FB;font-family:system-ui,sans-serif;color:#111827">
<div style="max-width:520px;margin:48px auto;padding:32px 24px;background:#fff;border:1.5px solid #E5E7EB;border-radius:20px;text-align:center">
${bodyHtml}
</div></body></html>`;
  return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

async function loadCfg(db: D1Database): Promise<Record<string, string>> {
  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  return cfg;
}

async function emailRequester(cfg: Record<string,string>, booking: any, offering: any, profile: any, action: 'confirm'|'decline', origin: string) {
  if (!cfg.resend_api_key) return;
  const human = formatDenverHuman(String(booking.slot_start));
  const title = String(offering?.title || 'your booking');
  const organizer = String(profile?.display_name || profile?.slug || 'the organizer');
  let subject = '';
  let html = '';
  let text = '';
  if (action === 'confirm') {
    subject = `Your booking is confirmed: ${title} on ${human}`;
    html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
      <h2 style="margin:0 0 12px">You're confirmed! 🎉</h2>
      <p style="color:#374151;line-height:1.5">${escapeHtml(organizer)} confirmed your booking.</p>
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:12px;padding:16px;margin:16px 0">
        <div style="font-size:18px;font-weight:700">${escapeHtml(title)}</div>
        <div style="color:#047857;margin-top:4px">${escapeHtml(human)}</div>
      </div>
      ${booking.message ? `<div style="font-size:13px;color:#6B7280">Your note: "${escapeHtml(String(booking.message))}"</div>` : ''}
      <div style="font-size:12px;color:#9CA3AF;margin-top:24px">View the organizer's page: <a href="${origin}/u/${encodeURIComponent(profile.slug)}" style="color:#7C3AED">${origin}/u/${escapeHtml(profile.slug)}</a></div>
    </div>`;
    text = `You're confirmed!\n\n${title}\n${human}\n\nOrganizer: ${organizer}\n${origin}/u/${profile.slug}`;
  } else {
    subject = `Booking update for ${title}`;
    html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
      <h2 style="margin:0 0 12px">Booking update</h2>
      <p style="color:#374151;line-height:1.5">Unfortunately ${escapeHtml(organizer)} can't accommodate your request for <strong>${escapeHtml(title)}</strong> on ${escapeHtml(human)}.</p>
      <p style="color:#374151;line-height:1.5">Feel free to browse other times at <a href="${origin}/u/${encodeURIComponent(profile.slug)}/book" style="color:#7C3AED">${origin}/u/${escapeHtml(profile.slug)}/book</a>.</p>
    </div>`;
    text = `Booking update\n\n${organizer} can't accommodate your request for ${title} on ${human}.\n\nTry another time: ${origin}/u/${profile.slug}/book`;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
        to: booking.requester_email, subject, text, html,
      }),
    });
  } catch {}
}

async function performAction(db: D1Database, booking: any, action: 'confirm'|'decline', request: Request) {
  const status = action === 'confirm' ? 'confirmed' : 'declined';
  await db.prepare(
    `UPDATE bookings SET status=?, responded_at=datetime('now') WHERE id=?`
  ).bind(status, booking.id).run();
  const offering = await db.prepare(`SELECT id, title FROM bookable_offerings WHERE id=?`).bind(booking.offering_id).first() as any;
  const profile = await db.prepare(`SELECT slug, display_name, email FROM profiles WHERE slug=?`).bind(booking.profile_slug).first() as any;
  const cfg = await loadCfg(db);
  const origin = cfg.site_url || new URL(request.url).origin || 'https://denversocialhub.com';
  await emailRequester(cfg, booking, offering, profile, action, origin);
  return { offering, profile };
}

export const GET: APIRoute = async ({ url, request }) => {
  const db = getDB();
  if (!db) return htmlPage('Booking', `<div>Database unavailable.</div>`);
  await ensureBookingsSchema(db);
  const token = url.searchParams.get('token') || '';
  const action = url.searchParams.get('action') || '';
  if (!token || (action !== 'confirm' && action !== 'decline')) {
    return htmlPage('Booking', `<h2>Invalid link</h2><p style="color:#6B7280">This booking link doesn't look right.</p>`);
  }
  const booking = await db.prepare(`SELECT * FROM bookings WHERE confirm_token=?`).bind(token).first() as any;
  if (!booking) {
    return htmlPage('Booking', `<h2>Not found</h2><p style="color:#6B7280">This booking link doesn't match a request.</p>`);
  }
  if (booking.status !== 'pending') {
    return htmlPage('Already handled', `
      <h2>Already handled</h2>
      <p style="color:#6B7280">This booking is already <strong>${escapeHtml(booking.status)}</strong>.</p>
      <p style="margin-top:16px"><a href="/u/${escapeHtml(booking.profile_slug)}/bookings" style="color:#7C3AED;font-weight:600;text-decoration:none">View all bookings →</a></p>
    `);
  }
  const { offering } = await performAction(db, booking, action as any, request);
  const human = formatDenverHuman(String(booking.slot_start));
  if (action === 'confirm') {
    return htmlPage('Confirmed', `
      <div style="font-size:48px;margin-bottom:8px">✓</div>
      <h2 style="margin:0 0 8px;color:#047857">Confirmed</h2>
      <p style="color:#374151">You confirmed <strong>${escapeHtml(String(offering?.title || ''))}</strong> with ${escapeHtml(String(booking.requester_name))}.</p>
      <p style="color:#6B7280;font-size:14px">${escapeHtml(human)}</p>
      <p style="margin-top:24px"><a href="/u/${escapeHtml(booking.profile_slug)}/bookings" style="color:#7C3AED;font-weight:600;text-decoration:none">View all bookings →</a></p>
    `);
  } else {
    return htmlPage('Declined', `
      <div style="font-size:40px;margin-bottom:8px">✕</div>
      <h2 style="margin:0 0 8px;color:#6B7280">Declined</h2>
      <p style="color:#374151">${escapeHtml(String(booking.requester_name))} has been notified.</p>
      <p style="margin-top:24px"><a href="/u/${escapeHtml(booking.profile_slug)}/bookings" style="color:#7C3AED;font-weight:600;text-decoration:none">View all bookings →</a></p>
    `);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);
  let body: any;
  try { body = await request.json(); }
  catch { return j({ ok: false, error: 'Invalid body' }, 400); }
  const id = parseInt(body?.booking_id, 10);
  const action = (body?.action || '').toString();
  if (!Number.isFinite(id)) return j({ ok: false, error: 'Missing booking_id' }, 400);
  if (action !== 'confirm' && action !== 'decline') return j({ ok: false, error: 'Invalid action' }, 400);
  const booking = await db.prepare(`SELECT * FROM bookings WHERE id=?`).bind(id).first() as any;
  if (!booking) return j({ ok: false, error: 'Not found' }, 404);
  if (!(await canEditProfile(cookies, String(booking.profile_slug)))) return j({ ok: false, error: 'Not authorized' }, 403);
  if (booking.status !== 'pending') return j({ ok: false, error: 'Already ' + booking.status });
  await performAction(db, booking, action, request);
  return j({ ok: true });
};
