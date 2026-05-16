import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

// Open photo uploads: anyone can upload to a past event. Uploader name
// comes from the body. We no longer gate on RSVP membership.
export async function POST({ request }: APIContext) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: "db_unavailable" }), { status: 500 });

  try {
    const { event_id, photo, caption, name, email } = await request.json() as any;
    if (!event_id || !photo) {
      return new Response(JSON.stringify({ error: "missing event_id or photo" }), { status: 400 });
    }

    const event: any = await db.prepare("SELECT is_past FROM events WHERE id=?").bind(event_id).first();
    if (!event?.is_past) {
      return new Response(JSON.stringify({ error: "Photos can only be uploaded after the event" }), { status: 403 });
    }

    if (photo.length > 2 * 1024 * 1024 * 1.37) {
      return new Response(JSON.stringify({ error: "Photo too large (max 2MB)" }), { status: 400 });
    }

    const cleanName = (name || '').toString().trim() || 'Community Member';
    const cleanEmail = (email || '').toString().trim().toLowerCase() || `anon:${cleanName.toLowerCase()}`;

    await db.prepare(
      "INSERT INTO event_photos (event_id, email, name, photo_url, caption, created_at) VALUES (?,?,?,?,?,?)"
    ).bind(event_id, cleanEmail, cleanName, photo, caption || '', new Date().toISOString()).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
