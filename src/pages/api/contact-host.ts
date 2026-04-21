import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }

  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be logged in to message a host' }), { status: 401 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const body = await request.json() as any;
    const { event_id, host_id, message } = body;

    if (!event_id || !host_id || !message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Event, host, and message are required' }), { status: 400 });
    }

    // Verify user has RSVP'd to this event (privacy gate)
    const rsvp: any = await db.prepare(
      "SELECT id FROM event_rsvps WHERE event_id = ? AND member_email = ?"
    ).bind(event_id, user.email).first();

    if (!rsvp) {
      return new Response(JSON.stringify({ error: 'You must RSVP before contacting the host' }), { status: 403 });
    }

    // Don't let host message themselves
    if (user.id === parseInt(host_id)) {
      return new Response(JSON.stringify({ error: "You're the host!" }), { status: 400 });
    }

    // Rate limit: max 3 messages per user per event
    const count: any = await db.prepare(
      "SELECT COUNT(*) as cnt FROM host_messages WHERE event_id = ? AND sender_id = ?"
    ).bind(event_id, user.id).first();

    if (count && count.cnt >= 3) {
      return new Response(JSON.stringify({ error: 'Message limit reached for this event (3 max). Join Discord for more chat.' }), { status: 429 });
    }

    const cleanMessage = message.trim().slice(0, 500);

    await db.prepare(
      "INSERT INTO host_messages (event_id, host_id, sender_id, sender_name, sender_email, message) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(event_id, host_id, user.id, user.name || 'Member', user.email, cleanMessage).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
