import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }
  if (!user) return new Response(JSON.stringify({ error: "login_required" }), { status: 401 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "db_unavailable" }), { status: 500 });

  try {
    const { event_id, photo, caption } = await request.json();
    if (!event_id || !photo) {
      return new Response(JSON.stringify({ error: "missing event_id or photo" }), { status: 400 });
    }

    // Verify user RSVP'd to this event
    const rsvp = await db.prepare("SELECT id FROM event_rsvps WHERE event_id=? AND member_email=?")
      .bind(event_id, user.email).first();
    if (!rsvp) {
      return new Response(JSON.stringify({ error: "You must RSVP to upload photos" }), { status: 403 });
    }

    // Verify event is past
    const event: any = await db.prepare("SELECT is_past FROM events WHERE id=?").bind(event_id).first();
    if (!event?.is_past) {
      return new Response(JSON.stringify({ error: "Photos can only be uploaded after the event" }), { status: 403 });
    }

    // Validate base64 image (must be under 2MB after encoding)
    if (photo.length > 2 * 1024 * 1024 * 1.37) { // base64 is ~37% larger
      return new Response(JSON.stringify({ error: "Photo too large (max 2MB)" }), { status: 400 });
    }

    // Store photo URL (base64 data URI for now — could move to R2 later)
    await db.prepare(
      "INSERT INTO event_photos (event_id, email, name, photo_url, caption, created_at) VALUES (?,?,?,?,?,?)"
    ).bind(
      event_id,
      user.email,
      user.name || '',
      photo,
      caption || '',
      new Date().toISOString()
    ).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
