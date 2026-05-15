// Combined endpoint for the community-feel features (intros, favors,
// calendar entries, named roles). Each action is gated appropriately.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureCommunitySchema } from '../../lib/community-schema';

export const prerender = false;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}

  const db = getDB();
  if (!db) return bad('db', 500);
  await ensureCommunitySchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;
  const isSuperAdmin = (user?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || user?.role === 'admin';

  // ── INTROS ──
  if (action === 'create_intro') {
    if (!user?.email) return bad('not_signed_in', 401);
    const text = String(body.body || '').trim();
    if (text.length < 5) return bad('too_short');
    if (text.length > 500) return bad('too_long');
    const member: any = await db.prepare("SELECT name, neighborhood FROM members WHERE LOWER(email)=LOWER(?)").bind(user.email).first();
    await db.prepare(
      'INSERT OR REPLACE INTO member_intros (member_email, member_name, neighborhood, body) VALUES (?, ?, ?, ?)'
    ).bind(user.email, member?.name || user.name || user.email.split('@')[0], member?.neighborhood || '', text).run();
    return ok({});
  }
  if (action === 'delete_intro') {
    if (!user?.email) return bad('not_signed_in', 401);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    const intro: any = await db.prepare('SELECT member_email FROM member_intros WHERE id=?').bind(id).first();
    if (!intro) return bad('not_found', 404);
    const isAuthor = (intro.member_email || '').toLowerCase() === user.email.toLowerCase();
    if (!isAuthor && !isAdmin) return bad('not_authorized', 403);
    await db.prepare('DELETE FROM member_intros WHERE id=?').bind(id).run();
    return ok({});
  }

  // ── FAVORS ──
  if (action === 'create_favor') {
    if (!user?.email) return bad('not_signed_in', 401);
    const kind = String(body.kind || '').trim();
    if (kind !== 'offer' && kind !== 'need') return bad('bad_kind');
    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    const neighborhood = String(body.neighborhood || '').trim();
    if (title.length < 3) return bad('title');
    if (title.length > 100) return bad('title_too_long');
    if (text.length > 600) return bad('body_too_long');
    const member: any = await db.prepare("SELECT name FROM members WHERE LOWER(email)=LOWER(?)").bind(user.email).first();
    await db.prepare(
      'INSERT INTO favors (member_email, member_name, kind, title, body, neighborhood) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(user.email, member?.name || user.name || user.email.split('@')[0], kind, title, text, neighborhood).run();
    return ok({});
  }
  if (action === 'close_favor') {
    if (!user?.email) return bad('not_signed_in', 401);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    const f: any = await db.prepare('SELECT member_email FROM favors WHERE id=?').bind(id).first();
    if (!f) return bad('not_found', 404);
    const isAuthor = (f.member_email || '').toLowerCase() === user.email.toLowerCase();
    if (!isAuthor && !isAdmin) return bad('not_authorized', 403);
    await db.prepare("UPDATE favors SET status='closed', closed_at=datetime('now') WHERE id=?").bind(id).run();
    return ok({});
  }
  if (action === 'delete_favor') {
    if (!user?.email) return bad('not_signed_in', 401);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    const f: any = await db.prepare('SELECT member_email FROM favors WHERE id=?').bind(id).first();
    if (!f) return bad('not_found', 404);
    const isAuthor = (f.member_email || '').toLowerCase() === user.email.toLowerCase();
    if (!isAuthor && !isAdmin) return bad('not_authorized', 403);
    await db.prepare('DELETE FROM favors WHERE id=?').bind(id).run();
    return ok({});
  }

  // ── CALENDAR (admin only for now) ──
  if (action === 'create_calendar') {
    if (!isAdmin) return bad('not_authorized', 403);
    const title = String(body.title || '').trim();
    const kind = String(body.kind || 'community').trim();
    const date_label = String(body.date_label || '').trim();
    const sort_month = parseInt(body.sort_month) || null;
    const sort_day = parseInt(body.sort_day) || null;
    if (title.length < 2) return bad('title');
    await db.prepare(
      'INSERT INTO community_calendar (title, kind, date_label, sort_month, sort_day, description, url) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(title, kind, date_label, sort_month, sort_day, body.description || '', body.url || '').run();
    return ok({});
  }
  if (action === 'delete_calendar') {
    if (!isAdmin) return bad('not_authorized', 403);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    await db.prepare('DELETE FROM community_calendar WHERE id=?').bind(id).run();
    return ok({});
  }

  // ── NAMED ROLES (admin only) ──
  if (action === 'set_role') {
    if (!isAdmin) return bad('not_authorized', 403);
    const targetEmail = String(body.email || '').trim().toLowerCase();
    const label = String(body.label || '').trim().slice(0, 40);
    if (!targetEmail.includes('@')) return bad('email');
    await db.prepare('UPDATE members SET extra_role=? WHERE LOWER(email)=?').bind(label || null, targetEmail).run();
    return ok({});
  }

  return bad('unknown_action');
};
