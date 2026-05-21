import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
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

async function loadCfg(db: D1Database): Promise<Record<string, string>> {
  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  return cfg;
}

async function emailHost(cfg: Record<string, string>, booking: any, offering: any, profile: any, origin: string) {
  if (!cfg.resend_api_key || !profile?.email) return;
  const human = formatDenverHuman(String(booking.slot_start));
  const title = String(offering?.title || 'a booking');
  const requester = String(booking.requester_name || 'The requester');
  const dashUrl = `${origin}/u/${profile.slug}/bookings`;
  const subject = `Cancelled by requester — ${title} on ${human}`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
    <h2 style="margin:0 0 12px">Booking cancelled</h2>
    <p style="color:#374151;line-height:1.5"><strong>${escapeHtml(requester)}</strong> cancelled their request for <strong>${escapeHtml(title)}</strong>.</p>
    <div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:16px 0">
      <div style="color:#6B7280;font-size:14px">${escapeHtml(human)}</div>
    </div>
    <div style="font-size:12px;color:#9CA3AF;margin-top:24px">
      Manage requests at <a href="${dashUrl}" style="color:#7C3AED">your bookings dashboard</a>.
    </div>
  </div>`;
  const text = `Booking cancelled\n\n${requester} cancelled their request for ${title} on ${human}.\n\nDashboard: ${dashUrl}`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
        to: profile.email, subject, text, html,
      }),
    });
  } catch {}
}

export const GET: APIRoute = async ({ url, request }) => {
  const db = getDB();
  if (!db) return htmlPage('Cancel booking', `<div>Database unavailable.</div>`);
  await ensureBookingsSchema(db);
  const token = url.searchParams.get('token') || '';
  if (!token) {
    return htmlPage('Cancel booking', `<h2>Invalid link</h2><p style="color:#6B7280">This cancel link doesn't look right.</p>`);
  }
  const booking = await db.prepare(`SELECT * FROM bookings WHERE cancel_token=?`).bind(token).first() as any;
  if (!booking) {
    return htmlPage('Cancel booking', `<h2>Not found</h2><p style="color:#6B7280">This cancel link doesn't match a request — it may have already been used.</p>`);
  }
  if (booking.status === 'cancelled') {
    return htmlPage('Already cancelled', `
      <div style="font-size:40px;margin-bottom:8px">✓</div>
      <h2 style="margin:0 0 8px;color:#6B7280">Already cancelled</h2>
      <p style="color:#374151">This booking is already cancelled.</p>
    `);
  }
  if (booking.status === 'declined') {
    return htmlPage('Already declined', `
      <h2 style="margin:0 0 8px;color:#6B7280">Already declined</h2>
      <p style="color:#374151">The organizer already declined this request — no action needed.</p>
    `);
  }

  // Set status + invalidate the token (one-shot).
  await db.prepare(
    `UPDATE bookings SET status='cancelled', responded_at=datetime('now'), cancel_token='' WHERE id=?`
  ).bind(booking.id).run();

  const offering = await db.prepare(`SELECT id, title FROM bookable_offerings WHERE id=?`).bind(booking.offering_id).first() as any;
  const profile = await db.prepare(`SELECT slug, display_name, email FROM profiles WHERE slug=?`).bind(booking.profile_slug).first() as any;
  const cfg = await loadCfg(db);
  const origin = cfg.site_url || new URL(request.url).origin || 'https://denversocialhub.com';
  await emailHost(cfg, booking, offering, profile, origin);

  const human = formatDenverHuman(String(booking.slot_start));
  const title = String(offering?.title || '');
  return htmlPage('Cancelled', `
    <div style="font-size:48px;margin-bottom:8px">✓</div>
    <h2 style="margin:0 0 8px;color:#047857">Your booking is cancelled</h2>
    <p style="color:#374151">We let the host know.</p>
    ${title ? `<div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:12px;padding:14px;margin:16px 0;text-align:left">
      <div style="font-size:15px;font-weight:700">${escapeHtml(title)}</div>
      <div style="color:#6B7280;font-size:13px;margin-top:4px">${escapeHtml(human)}</div>
    </div>` : ''}
    ${profile ? `<p style="margin-top:24px"><a href="/u/${escapeHtml(profile.slug)}" style="color:#7C3AED;font-weight:600;text-decoration:none">← Back to ${escapeHtml(String(profile.display_name || profile.slug))}</a></p>` : ''}
  `);
};
