import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const name = (body.name || '').trim();
    const email = (body.email || '').trim();
    const subject = (body.subject || '').trim();
    const message = (body.message || '').trim();

    if (!name || !message) {
      return new Response(JSON.stringify({ ok: false, error: 'Name and message are required.' }), { status: 400 });
    }
    if (message.length > 2000) {
      return new Response(JSON.stringify({ ok: false, error: 'Message too long (max 2000 chars).' }), { status: 400 });
    }

    const db = getDB();
    if (!db) {
      return new Response(JSON.stringify({ ok: false, error: 'Database unavailable.' }), { status: 500 });
    }

    await db.prepare(
      `INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)`
    ).bind(name, email || null, subject || null, message).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    console.error('Contact form error:', e);
    return new Response(JSON.stringify({ ok: false, error: 'Something went wrong.' }), { status: 500 });
  }
};
