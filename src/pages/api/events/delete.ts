// Delete an event. With member accounts gone, only the email-code
// admin can delete events. Cascades through related tables so we
// don't leave orphaned RSVPs/comments/etc.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin-auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAdmin(cookies))) {
    return new Response(JSON.stringify({ ok: false, error: 'not_authorized' }), { status: 401 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });

  const body = await request.json().catch(() => ({})) as any;
  const eventId = parseInt(body?.event_id);
  if (!eventId) return new Response(JSON.stringify({ ok: false, error: 'event_id' }), { status: 400 });

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
