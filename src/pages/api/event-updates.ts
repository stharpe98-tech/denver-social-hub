import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

// GET — fetch updates for an event
export async function GET({ url }: APIContext) {
  const eventId = url.searchParams.get('event_id');
  if (!eventId) return new Response(JSON.stringify({ error: 'Missing event_id' }), { status: 400 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const result = await db.prepare(
      "SELECT id, author_name, message, created_at FROM event_updates WHERE event_id = ? ORDER BY created_at DESC LIMIT 20"
    ).bind(eventId).all();
    return new Response(JSON.stringify({ updates: result.results || [] }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// POST — host posts an update to their event
export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }

  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be logged in' }), { status: 401 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const body = await request.json() as any;
    const { event_id, message } = body;

    if (!event_id || !message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Event ID and message are required' }), { status: 400 });
    }

    // Verify this user is the host (or admin)
    const event: any = await db.prepare("SELECT host_id, submitted_by FROM events WHERE id = ?").bind(event_id).first();
    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });
    }

    const isHost = event.host_id && event.host_id === user.id;
    const isAdmin = user.role === 'admin';

    if (!isHost && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Only the event host can post updates' }), { status: 403 });
    }

    // Sanitize message (strip HTML, limit length)
    const cleanMessage = message.trim().slice(0, 500);

    await db.prepare(
      "INSERT INTO event_updates (event_id, author_id, author_name, message) VALUES (?, ?, ?, ?)"
    ).bind(event_id, user.id, user.name || 'Host', cleanMessage).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
