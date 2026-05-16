// Combined endpoint for the community-feel features (intros, favors,
// calendar entries, named roles).
//
// With member accounts offline:
//   - Intros: disabled (per-member identity required to dedupe).
//   - Favors: open — anyone can post offer/need by typing a name.
//   - Calendar / roles: admin-only via the email-code admin cookie.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureCommunitySchema } from '../../lib/community-schema';
import { isAdmin } from '../../lib/admin-auth';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return bad('db', 500);
  await ensureCommunitySchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;

  // ── INTROS — disabled (per-member identity required) ──
  if (action === 'create_intro' || action === 'delete_intro') {
    return bad('disabled', 200);
  }

  // ── FAVORS (open) ──
  if (action === 'create_favor') {
    // Accept extended board kinds (event/announce/just_because) but map
    // them down to the legacy 'offer'/'need' column for back-compat.
    const VALID_EXT = new Set(['need', 'offer', 'event', 'announce', 'just_because']);
    const rawKind = String(body.kind || body.kind_extended || '').trim();
    if (!VALID_EXT.has(rawKind)) return bad('bad_kind');
    const kindExt = rawKind;
    const legacyKind = rawKind === 'need' ? 'need' : 'offer';

    const title = String(body.title || '').trim();
    const text = String(body.body || '').trim();
    const neighborhood = String(body.neighborhood || '').trim();
    const name = (String(body.name || body.member_name || '').trim());
    if (!name) return bad('name');
    const email = String(body.contact_email || body.email || '').trim().toLowerCase();
    const phone = String(body.contact_phone || '').trim();
    if (!email && !phone) return bad('contact_required');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad('bad_email');
    if (title.length < 3) return bad('title');
    if (title.length > 100) return bad('title_too_long');
    if (text.length > 600) return bad('body_too_long');

    const ownerEmail = email || `anon:${name.toLowerCase()}`;
    const r = await db.prepare(
      `INSERT INTO favors
         (member_email, member_name, kind, title, body, neighborhood,
          contact_email, contact_phone, kind_extended)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(ownerEmail, name, legacyKind, title, text, neighborhood, email, phone, kindExt).run();
    const id = (r as any)?.meta?.last_row_id || null;
    return ok({ id });
  }
  if (action === 'close_favor' || action === 'delete_favor') {
    // Only admins can close/delete favors now — without member auth we
    // can't verify authorship.
    if (!(await isAdmin(cookies))) return bad('not_authorized', 403);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    if (action === 'close_favor') {
      await db.prepare("UPDATE favors SET status='closed', closed_at=datetime('now') WHERE id=?").bind(id).run();
    } else {
      await db.prepare('DELETE FROM favors WHERE id=?').bind(id).run();
    }
    return ok({});
  }

  // ── CALENDAR (admin only) ──
  if (action === 'create_calendar') {
    if (!(await isAdmin(cookies))) return bad('not_authorized', 403);
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
    if (!(await isAdmin(cookies))) return bad('not_authorized', 403);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    await db.prepare('DELETE FROM community_calendar WHERE id=?').bind(id).run();
    return ok({});
  }

  // ── NAMED ROLES (admin only) ──
  if (action === 'set_role') {
    if (!(await isAdmin(cookies))) return bad('not_authorized', 403);
    const targetEmail = String(body.email || '').trim().toLowerCase();
    const label = String(body.label || '').trim().slice(0, 40);
    if (!targetEmail.includes('@')) return bad('email');
    await db.prepare('UPDATE members SET extra_role=? WHERE LOWER(email)=?').bind(label || null, targetEmail).run();
    return ok({});
  }

  return bad('unknown_action');
};
