import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { validateSlug } from '../../../lib/profile-auth';
import {
  ensureBookingsSchema, randomToken, denverLocalToUtcIso, denverDow,
  formatDenverHuman, chopWindow,
} from '../../../lib/bookings-schema';

function s(v: any, max = 500): string {
  return (v == null ? '' : String(v)).slice(0, max).trim();
}

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);

  let body: any;
  try { body = await request.json(); }
  catch { return j({ ok: false, error: 'Invalid body' }, 400); }

  const slugV = validateSlug(body?.profile_slug || '');
  if (!slugV.ok) return j({ ok: false, error: slugV.error }, 400);
  const slug = slugV.slug;
  const offeringId = parseInt(body?.offering_id, 10);
  const slotStart = s(body?.slot_start, 40);
  const slotEnd = s(body?.slot_end, 40);
  const name = s(body?.requester_name, 120);
  const email = s(body?.requester_email, 200).toLowerCase();
  const phone = s(body?.requester_phone, 40);
  const message = s(body?.message, 2000);

  if (!Number.isFinite(offeringId)) return j({ ok: false, error: 'Missing offering_id' }, 400);
  if (!name) return j({ ok: false, error: 'Name required' }, 400);
  if (!email || !email.includes('@')) return j({ ok: false, error: 'Valid email required' }, 400);
  if (!slotStart || !slotEnd) return j({ ok: false, error: 'Slot required' }, 400);
  const slotMs = Date.parse(slotStart);
  if (!Number.isFinite(slotMs)) return j({ ok: false, error: 'Invalid slot_start' }, 400);
  if (slotMs < Date.now()) return j({ ok: false, error: 'Slot is in the past' }, 400);

  const offering = await db.prepare(
    `SELECT id, profile_slug, title, duration_min, archived FROM bookable_offerings WHERE id=?`
  ).bind(offeringId).first() as any;
  if (!offering || offering.archived || offering.profile_slug !== slug) {
    return j({ ok: false, error: 'Offering not available' }, 404);
  }

  // Validate slot matches an actual rule + isn't already taken.
  const rules = ((await db.prepare(
    `SELECT day_of_week, start_time, end_time, valid_from, valid_until
     FROM offering_availability WHERE offering_id=?`
  ).bind(offeringId).all())?.results || []) as any[];

  // Derive Denver-local date + HH:MM from slot_start.
  const startDate = new Date(slotStart);
  const dow = denverDow(startDate);
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(startDate);
  const hm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(startDate);

  let valid = false;
  for (const r of rules) {
    if (parseInt(String(r.day_of_week), 10) !== dow) continue;
    if (r.valid_from && ymd < String(r.valid_from)) continue;
    if (r.valid_until && ymd > String(r.valid_until)) continue;
    const chunks = chopWindow(String(r.start_time), String(r.end_time), parseInt(String(offering.duration_min), 10) || 30);
    for (const c of chunks) {
      if (c.start === hm) {
        // double-check the UTC encoding matches what client sent
        if (denverLocalToUtcIso(ymd, c.start) === slotStart) { valid = true; break; }
      }
    }
    if (valid) break;
  }
  if (!valid) return j({ ok: false, error: 'That slot is not available' }, 400);

  const taken = await db.prepare(
    `SELECT id FROM bookings WHERE offering_id=? AND slot_start=? AND status IN ('pending','confirmed')`
  ).bind(offeringId, slotStart).first();
  if (taken) return j({ ok: false, error: 'That slot was just taken' }, 409);

  const token = randomToken(24);
  const r = await db.prepare(
    `INSERT INTO bookings
       (profile_slug, offering_id, slot_start, slot_end, requester_name, requester_email, requester_phone, message, status, confirm_token)
     VALUES (?,?,?,?,?,?,?,?, 'pending', ?)`
  ).bind(slug, offeringId, slotStart, slotEnd, name, email, phone, message, token).run();
  const id = (r as any).meta?.last_row_id;

  // Send notification emails (best-effort — don't block on failure).
  try { await notifyOrganizer(db, request, { slug, offering, slotStart, name, email, phone, message, token }); } catch {}
  try { await notifyRequester(db, request, { slug, offering, slotStart, name, email, message }); } catch {}

  return j({ ok: true, id });
};

async function notifyOrganizer(db: D1Database, request: Request, p: {
  slug: string; offering: any; slotStart: string;
  name: string; email: string; phone: string; message: string; token: string;
}) {
  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((row: any) => { cfg[row.key] = row.value; });
  if (!cfg.resend_api_key) return;

  const profile = await db.prepare(
    `SELECT email, display_name FROM profiles WHERE slug=?`
  ).bind(p.slug).first() as any;
  if (!profile?.email) return;

  const origin = cfg.site_url || new URL(request.url).origin || 'https://denversocialhub.com';
  const acceptUrl = `${origin}/api/bookings/respond?token=${encodeURIComponent(p.token)}&action=confirm`;
  const declineUrl = `${origin}/api/bookings/respond?token=${encodeURIComponent(p.token)}&action=decline`;
  const dashUrl = `${origin}/u/${p.slug}/bookings`;
  const human = formatDenverHuman(p.slotStart);
  const title = String(p.offering.title);

  const subject = `New booking request — ${title} on ${human}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111827">
      <h2 style="margin:0 0 12px">New booking request</h2>
      <div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="font-size:18px;font-weight:700;margin-bottom:6px">${escapeHtml(title)}</div>
        <div style="color:#6B7280;font-size:14px">${escapeHtml(human)}</div>
      </div>
      <div style="margin-bottom:16px;font-size:14px;line-height:1.6">
        <div><strong>From:</strong> ${escapeHtml(p.name)}</div>
        <div><strong>Email:</strong> <a href="mailto:${encodeURIComponent(p.email)}">${escapeHtml(p.email)}</a></div>
        ${p.phone ? `<div><strong>Phone:</strong> ${escapeHtml(p.phone)}</div>` : ''}
        ${p.message ? `<div style="margin-top:10px;padding:10px 12px;background:#fff;border:1px solid #E5E7EB;border-radius:8px;white-space:pre-wrap">${escapeHtml(p.message)}</div>` : ''}
      </div>
      <table cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0">
        <tr>
          <td style="padding-right:8px">
            <a href="${acceptUrl}" style="display:block;background:#10B981;color:#fff;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;text-decoration:none">Accept →</a>
          </td>
          <td style="padding-left:8px">
            <a href="${declineUrl}" style="display:block;background:#fff;color:#374151;border:1.5px solid #E5E7EB;text-align:center;padding:14px 20px;border-radius:10px;font-weight:700;text-decoration:none">Decline</a>
          </td>
        </tr>
      </table>
      <div style="font-size:12px;color:#9CA3AF;text-align:center;margin-top:16px">
        Or manage all requests at <a href="${dashUrl}" style="color:#7C3AED">your bookings dashboard</a>.
      </div>
    </div>`;
  const text = `New booking request — ${title} on ${human}\n\nFrom: ${p.name} <${p.email}>${p.phone ? `\nPhone: ${p.phone}` : ''}${p.message ? `\n\n${p.message}` : ''}\n\nAccept: ${acceptUrl}\nDecline: ${declineUrl}\nDashboard: ${dashUrl}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
      to: profile.email, subject, text, html,
    }),
  });
}

async function notifyRequester(db: D1Database, request: Request, p: {
  slug: string; offering: any; slotStart: string;
  name: string; email: string; message: string;
}) {
  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((row: any) => { cfg[row.key] = row.value; });
  if (!cfg.resend_api_key) return;

  const profile = await db.prepare(
    `SELECT display_name FROM profiles WHERE slug=?`
  ).bind(p.slug).first() as any;
  const organizer = String(profile?.display_name || p.slug);

  const origin = cfg.site_url || new URL(request.url).origin || 'https://denversocialhub.com';
  const profileUrl = `${origin}/u/${encodeURIComponent(p.slug)}`;
  const human = formatDenverHuman(p.slotStart);
  const title = String(p.offering.title);
  const firstName = (p.name || 'there').split(' ')[0];

  const subject = `Request received — ${title} on ${human}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111827">
      <h2 style="margin:0 0 12px">Got it, ${escapeHtml(firstName)} — your request is in.</h2>
      <p style="color:#374151;line-height:1.55;margin:0 0 16px">
        We sent your request to <strong>${escapeHtml(organizer)}</strong>. You'll get another email the moment it's confirmed (or if they need to suggest a different time).
      </p>
      <div style="background:#F8F9FB;border:1px solid #E5E7EB;border-radius:12px;padding:16px;margin:16px 0">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B7280;margin-bottom:6px">Requested</div>
        <div style="font-size:17px;font-weight:700">${escapeHtml(title)}</div>
        <div style="color:#7C3AED;margin-top:4px">${escapeHtml(human)}</div>
      </div>
      ${p.message ? `<div style="font-size:13px;color:#6B7280;margin-top:12px">Your note: "${escapeHtml(p.message)}"</div>` : ''}
      <div style="font-size:12px;color:#9CA3AF;margin-top:24px">
        Organizer page: <a href="${profileUrl}" style="color:#7C3AED">${escapeHtml(profileUrl.replace(/^https?:\/\//, ''))}</a>
      </div>
    </div>`;
  const text = `Got it, ${firstName} — your request is in.\n\nWe sent your request to ${organizer}. You'll get another email the moment it's confirmed.\n\n${title}\n${human}\n\n${profileUrl}`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
      to: p.email, subject, text, html,
    }),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
