import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    const { name, email, potluckId } = b;
    const pid = parseInt(potluckId ?? '1');

    if (!name && !email) {
      return new Response(JSON.stringify({ ok: false, error: 'Provide your name or email' }), { status: 400 });
    }

    let rsvp: any = null;

    // Try email first (most reliable match)
    if (email) {
      rsvp = await db.prepare(`
        SELECT id, name, email, dish, guest_count, cancel_token, created_at
        FROM potluck_rsvp
        WHERE potluck_id=? AND LOWER(email)=LOWER(?) AND rsvp='yes'
        ORDER BY created_at DESC LIMIT 1
      `).bind(pid, email.trim()).first();
    }

    // Fall back to name match
    if (!rsvp && name) {
      rsvp = await db.prepare(`
        SELECT id, name, email, dish, guest_count, cancel_token, created_at
        FROM potluck_rsvp
        WHERE potluck_id=? AND LOWER(name)=LOWER(?) AND rsvp='yes' AND guest_count > 0
        ORDER BY created_at DESC LIMIT 1
      `).bind(pid, name.trim()).first();
    }

    if (!rsvp) {
      return new Response(JSON.stringify({ ok: false, error: 'No sign-up found. Check your name or email and try again.' }), { status: 404 });
    }

    return new Response(JSON.stringify({
      ok: true,
      token: rsvp.cancel_token,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
