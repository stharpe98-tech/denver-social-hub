// Delete an event. Allowed for the original host (host_id = user.id),
// any listed co-host, or the super-admin. Cascades through related
// tables so we don't leave orphaned RSVPs/comments/etc.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureCohostsSchema, isHostOrCohost } from '../../../lib/cohosts-schema';

export const prerender = false;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) {
    return new Response(JSON.stringify({ ok: false, error: 'not_signed_in' }), { status: 401 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });
  await ensureCohostsSchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const eventId = parseInt(body?.event_id);
  if (!eventId) return new Response(JSON.stringify({ ok: false, error: 'event_id' }), { status: 400 });

  // Permission model:
  //   - super-admin (owner) and role=admin: delete any event
  //   - host / co-hosts (mods, organizers): delete only their own events
  const isSuperAdmin = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || user.role === 'admin';
  if (!isAdmin && !(await isHostOrCohost(db, eventId, user))) {
    return new Response(JSON.stringify({ ok: false, error: 'not_authorized' }), { status: 403 });
  }

  // Cascade — D1/SQLite doesn't enforce foreign keys here, so wipe manually.
  // Each delete is wrapped so a missing table (older DB) doesn't break the whole call.
  const wipes = [
    'DELETE FROM event_rsvps WHERE event_id = ?',
    'DELETE FROM event_cohosts WHERE event_id = ?',
    'DELETE FROM comments WHERE event_id = ?',
    'DELETE FROM bring_items WHERE event_id = ?',
    'DELETE FROM event_photos WHERE event_id = ?',
    'DELETE FROM event_ratings WHERE event_id = ?',
    'DELETE FROM events WHERE id = ?',
  ];
  for (const sql of wipes) {
    try { await db.prepare(sql).bind(eventId).run(); } catch {}
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
