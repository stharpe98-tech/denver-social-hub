// Create or resolve a report. Anyone signed in can create; only admins
// (super-admin or role=admin) can resolve.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureReportsSchema } from '../../lib/reports-schema';

export const prerender = false;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';
const VALID_KINDS = new Set(['event', 'group', 'member', 'comment']);
const VALID_REASONS = new Set(['harassment', 'spam', 'inaccurate', 'inappropriate', 'other']);

function ok(data: any = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), { headers: { 'Content-Type': 'application/json' } });
}
function bad(error: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) return bad('not_signed_in', 401);

  const db = getDB();
  if (!db) return bad('db', 500);
  await ensureReportsSchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;

  if (action === 'create') {
    const kind = String(body.target_kind || '').toLowerCase();
    const targetId = String(body.target_id || '').trim();
    const reason = String(body.reason || '').toLowerCase();
    const details = String(body.details || '').slice(0, 1000);
    if (!VALID_KINDS.has(kind)) return bad('bad_kind');
    if (!targetId) return bad('target_id');
    if (!VALID_REASONS.has(reason)) return bad('bad_reason');

    // De-dupe: same reporter, same target, same reason, still open
    const existing: any = await db.prepare(
      "SELECT id FROM reports WHERE LOWER(reporter_email)=LOWER(?) AND target_kind=? AND target_id=? AND reason=? AND status='open'"
    ).bind(user.email, kind, targetId, reason).first();
    if (existing) return ok({ already: true, id: existing.id });

    const res: any = await db.prepare(
      "INSERT INTO reports (reporter_email, target_kind, target_id, reason, details) VALUES (?, ?, ?, ?, ?)"
    ).bind(user.email, kind, targetId, reason, details).run();
    return ok({ id: res?.meta?.last_row_id || null });
  }

  // Resolve/dismiss — admin only
  const isSuperAdmin = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || user.role === 'admin';
  if (!isAdmin) return bad('not_authorized', 403);

  if (action === 'resolve' || action === 'dismiss') {
    const id = parseInt(body.id);
    const note = String(body.note || '').slice(0, 500);
    if (!id) return bad('id');
    await db.prepare(
      "UPDATE reports SET status=?, resolved_at=datetime('now'), resolved_by=?, resolution_note=? WHERE id=?"
    ).bind(action === 'resolve' ? 'resolved' : 'dismissed', user.email, note, id).run();
    return ok({});
  }

  return bad('unknown_action');
};
