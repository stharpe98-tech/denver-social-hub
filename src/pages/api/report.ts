// Create or resolve a report. Anyone can create (reporter identity is
// the email they type in); only admins can resolve.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureReportsSchema } from '../../lib/reports-schema';
import { isAdmin, getAdminEmail } from '../../lib/admin-auth';

export const prerender = false;

const VALID_KINDS = new Set(['event', 'group', 'member', 'comment']);
const VALID_REASONS = new Set(['harassment', 'spam', 'inaccurate', 'inappropriate', 'other']);

function ok(data: any = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), { headers: { 'Content-Type': 'application/json' } });
}
function bad(error: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
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
    const reporterEmail = String(body.reporter_email || body.email || '').trim().toLowerCase() || 'anonymous';
    if (!VALID_KINDS.has(kind)) return bad('bad_kind');
    if (!targetId) return bad('target_id');
    if (!VALID_REASONS.has(reason)) return bad('bad_reason');

    const existing: any = await db.prepare(
      "SELECT id FROM reports WHERE LOWER(reporter_email)=LOWER(?) AND target_kind=? AND target_id=? AND reason=? AND status='open'"
    ).bind(reporterEmail, kind, targetId, reason).first();
    if (existing) return ok({ already: true, id: existing.id });

    const res: any = await db.prepare(
      "INSERT INTO reports (reporter_email, target_kind, target_id, reason, details) VALUES (?, ?, ?, ?, ?)"
    ).bind(reporterEmail, kind, targetId, reason, details).run();
    return ok({ id: res?.meta?.last_row_id || null });
  }

  if (!(await isAdmin(cookies))) return bad('not_authorized', 403);
  const adminEmail = (await getAdminEmail(cookies)) || 'admin';

  if (action === 'resolve' || action === 'dismiss') {
    const id = parseInt(body.id);
    const note = String(body.note || '').slice(0, 500);
    if (!id) return bad('id');
    await db.prepare(
      "UPDATE reports SET status=?, resolved_at=datetime('now'), resolved_by=?, resolution_note=? WHERE id=?"
    ).bind(action === 'resolve' ? 'resolved' : 'dismissed', adminEmail, note, id).run();
    return ok({});
  }

  return bad('unknown_action');
};
