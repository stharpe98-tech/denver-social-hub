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

// POST — admin posts an update to an event. (With member accounts
// gone, only the email-code admin can post updates.)
import { isAdmin as isAdminCookie, getAdminEmail } from '../../lib/admin-auth';

export async function POST({ request, cookies }: APIContext) {
  if (!(await isAdminCookie(cookies))) {
    return new Response(JSON.stringify({ error: 'admin only' }), { status: 401 });
  }
  const adminEmail = (await getAdminEmail(cookies)) || 'admin';

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const body = await request.json() as any;
    const { event_id, message } = body;

    if (!event_id || !message || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Event ID and message are required' }), { status: 400 });
    }

    const event: any = await db.prepare("SELECT host_id FROM events WHERE id = ?").bind(event_id).first();
    if (!event) {
      return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });
    }

    const cleanMessage = message.trim().slice(0, 500);

    await db.prepare(
      "INSERT INTO event_updates (event_id, author_id, author_name, message) VALUES (?, ?, ?, ?)"
    ).bind(event_id, null, adminEmail.split('@')[0] || 'Host', cleanMessage).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
