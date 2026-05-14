// Manage event co-hosts. The event creator (matched via host_id =
// user.id) can add/remove co-hosts. Co-hosts themselves can add other
// co-hosts but can't remove the creator.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureCohostsSchema, isHostOrCohost } from '../../../lib/cohosts-schema';

export const prerender = false;

function bad(error: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } });
}
function ok(data: any = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), { headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) return bad('not_signed_in', 401);

  const db = getDB();
  if (!db) return bad('db', 500);
  await ensureCohostsSchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;
  const eventId = parseInt(body?.event_id);
  if (!eventId) return bad('event_id');

  if (!(await isHostOrCohost(db, eventId, user))) return bad('not_authorized', 403);

  if (action === 'add') {
    const email = (body.email || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) return bad('bad_email');
    const member: any = await db.prepare('SELECT 1 FROM members WHERE LOWER(email)=?').bind(email).first();
    if (!member) return bad('member_not_found', 404);
    await db.prepare(
      'INSERT OR IGNORE INTO event_cohosts (event_id, member_email, added_by) VALUES (?, ?, ?)'
    ).bind(eventId, email, user.id || null).run();
    return ok({});
  }

  if (action === 'remove') {
    const email = (body.email || '').toString().trim().toLowerCase();
    if (!email) return bad('bad_email');
    // Only the creator can remove other co-hosts. A co-host can remove
    // themselves but not other co-hosts.
    const ev: any = await db.prepare('SELECT host_id FROM events WHERE id=?').bind(eventId).first();
    const isCreator = ev?.host_id && user.id && ev.host_id === user.id;
    if (!isCreator && email !== user.email.toLowerCase()) return bad('not_authorized', 403);
    await db.prepare('DELETE FROM event_cohosts WHERE event_id=? AND LOWER(member_email)=?').bind(eventId, email).run();
    return ok({});
  }

  return bad('unknown_action');
};
