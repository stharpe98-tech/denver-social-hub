// Phone-request actions: send, approve (with the phone), decline, list.
// Gated to profile-page holders — identity comes from dsn_profile_<slug>.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePhoneRequestsSchema } from '../../lib/phone-requests-schema';
import { getCurrentProfile } from '../../lib/profile-auth';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400, extra: any = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

const PHONE_REQ_HOURLY_CAP = 5;

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return bad('db', 500);
  await ensurePhoneRequestsSchema(db);

  const currentProfile = await getCurrentProfile(cookies, db, request);
  if (!currentProfile) {
    return bad('profile_required', 401, { message: 'You need a /u/[slug] page to request a phone number.' });
  }
  const me = currentProfile.email;

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;

  if (action === 'request') {
    const to = String(body.to || '').trim().toLowerCase();
    const note = String(body.note || '').trim().slice(0, 200);
    if (!to.includes('@')) return bad('to_email');
    if (to === me) return bad('self');
    // Target must be an organizer — regulars don't receive phone requests.
    const target: any = await db.prepare(
      `SELECT tier FROM profiles WHERE LOWER(email)=? AND status='live' LIMIT 1`
    ).bind(to).first();
    if (!target) return bad('not_a_member', 404);
    if (target.tier !== 'organizer') {
      return bad('organizer_only', 403, { message: 'You can only message organizers.' });
    }
    // Rate limit: don't let one viewer fire more than N requests per hour.
    const recent: any = await db.prepare(
      "SELECT COUNT(*) AS c FROM phone_requests WHERE LOWER(from_email)=? AND created_at > datetime('now', '-1 hour')"
    ).bind(me).first();
    if (recent && Number(recent.c) >= PHONE_REQ_HOURLY_CAP) {
      return bad('rate_limited', 429);
    }
    // De-dupe pending requests.
    const existing: any = await db.prepare(
      "SELECT id, status FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? AND status='pending'"
    ).bind(me, to).first();
    if (existing) return ok({ already: true, id: existing.id });
    const res: any = await db.prepare(
      'INSERT INTO phone_requests (from_email, to_email, note) VALUES (?, ?, ?)'
    ).bind(me, to, note).run();
    return ok({ id: res?.meta?.last_row_id });
  }

  if (action === 'approve') {
    const id = parseInt(body.id);
    const phone = String(body.phone || '').trim();
    if (!id) return bad('id');
    if (!phone || phone.length < 7) return bad('phone');
    const req: any = await db.prepare('SELECT * FROM phone_requests WHERE id=?').bind(id).first();
    if (!req) return bad('not_found', 404);
    if ((req.to_email || '').toLowerCase() !== me) return bad('not_authorized', 403);
    if (req.status !== 'pending') return bad('already_responded');
    await db.prepare(
      "UPDATE phone_requests SET status='approved', shared_phone=?, responded_at=datetime('now') WHERE id=?"
    ).bind(phone, id).run();
    return ok({});
  }

  if (action === 'decline') {
    const id = parseInt(body.id);
    if (!id) return bad('id');
    const req: any = await db.prepare('SELECT * FROM phone_requests WHERE id=?').bind(id).first();
    if (!req) return bad('not_found', 404);
    if ((req.to_email || '').toLowerCase() !== me) return bad('not_authorized', 403);
    if (req.status !== 'pending') return bad('already_responded');
    await db.prepare(
      "UPDATE phone_requests SET status='declined', responded_at=datetime('now') WHERE id=?"
    ).bind(id).run();
    return ok({});
  }

  if (action === 'list_incoming') {
    const r = await db.prepare(`
      SELECT pr.*, p.display_name as from_name, p.slug as from_slug
      FROM phone_requests pr
      LEFT JOIN profiles p ON LOWER(p.email) = LOWER(pr.from_email)
      WHERE LOWER(pr.to_email)=? AND pr.status='pending'
      ORDER BY pr.id DESC
    `).bind(me).all();
    return ok({ requests: r?.results || [] });
  }

  if (action === 'status') {
    const other = String(body.other || '').trim().toLowerCase();
    if (!other) return bad('other');
    const sent: any = await db.prepare(
      'SELECT id, status, shared_phone FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? ORDER BY id DESC LIMIT 1'
    ).bind(me, other).first();
    const received: any = await db.prepare(
      'SELECT id, status FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? ORDER BY id DESC LIMIT 1'
    ).bind(other, me).first();
    return ok({ sent, received });
  }

  return bad('unknown_action');
};
