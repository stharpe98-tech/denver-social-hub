import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureBookingsSchema } from '../../../lib/bookings-schema';

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}

function clampRating(n: any): number | null {
  const r = parseInt(n, 10);
  if (!Number.isFinite(r)) return null;
  if (r < 1 || r > 5) return null;
  return r;
}

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);

  let body: any;
  try { body = await request.json(); }
  catch { return j({ ok: false, error: 'Invalid body' }, 400); }

  const token = String(body?.token || '').trim();
  if (!token) return j({ ok: false, error: 'Missing token' }, 400);

  const rating = clampRating(body?.rating);
  if (rating === null) return j({ ok: false, error: 'Rating must be 1-5' }, 400);

  const reviewText = String(body?.review_text || '').slice(0, 1000);

  const booking = await db.prepare(
    `SELECT id, status, slot_end FROM bookings WHERE confirm_token=?`
  ).bind(token).first() as any;
  if (!booking) return j({ ok: false, error: 'Booking not found' }, 404);
  if (booking.status !== 'confirmed') {
    return j({ ok: false, error: 'Only confirmed bookings can be reviewed' }, 400);
  }
  if (booking.slot_end && Date.parse(String(booking.slot_end)) > Date.now()) {
    return j({ ok: false, error: 'Appointment is in the future' }, 400);
  }

  await db.prepare(
    `UPDATE bookings SET rating=?, review_text=?, reviewed_at=? WHERE id=?`
  ).bind(rating, reviewText, new Date().toISOString(), booking.id).run();

  return j({ ok: true });
};
