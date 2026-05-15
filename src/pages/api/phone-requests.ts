// Phone-request actions: send, approve (with the phone), decline, list.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePhoneRequestsSchema } from '../../lib/phone-requests-schema';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) return bad('not_signed_in', 401);

  const db = getDB();
  if (!db) return bad('db', 500);
  await ensurePhoneRequestsSchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;
  const me = (user.email || '').toLowerCase();

  if (action === 'request') {
    const to = String(body.to || '').trim().toLowerCase();
    const note = String(body.note || '').trim().slice(0, 200);
    if (!to.includes('@')) return bad('to_email');
    if (to === me) return bad('self');
    const target: any = await db.prepare('SELECT 1 FROM members WHERE LOWER(email)=?').bind(to).first();
    if (!target) return bad('not_a_member', 404);
    // De-dupe: don't create another pending one
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
    // Pending requests sent TO me
    const r = await db.prepare(`
      SELECT pr.*, m.name as from_name
      FROM phone_requests pr
      LEFT JOIN members m ON LOWER(m.email) = LOWER(pr.from_email)
      WHERE LOWER(pr.to_email)=? AND pr.status='pending'
      ORDER BY pr.id DESC
    `).bind(me).all();
    return ok({ requests: r?.results || [] });
  }

  if (action === 'status') {
    // Status of any request between me and another member
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
