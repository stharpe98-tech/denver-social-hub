import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  const token = url.searchParams.get('token');
  if (!token) return new Response(JSON.stringify({ ok: false, error: 'No token' }), { status: 400 });
  const rsvp = await db.prepare(`
    SELECT r.*, p.title, p.date_label, p.time_label, p.location, p.location_detail
    FROM potluck_rsvp r JOIN potlucks p ON p.id=r.potluck_id
    WHERE r.cancel_token=?
  `).bind(token).first();
  if (!rsvp) return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404 });
  return new Response(JSON.stringify({ ok: true, rsvp }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    const { action, token } = b;
    if (!token) return new Response(JSON.stringify({ ok: false, error: 'No token' }), { status: 400 });

    if (action === 'cancel') {
      await db.prepare(`DELETE FROM potluck_rsvp WHERE cancel_token=?`).bind(token).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'update') {
      await db.prepare(`UPDATE potluck_rsvp SET dish=?, dish_category=?, guest_count=?, dietary=? WHERE cancel_token=?`)
        .bind(b.dish??'', b.dishCategory??'', parseInt(b.guestCount??'1'), b.dietary??'', token).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
