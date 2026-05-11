import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

// Stores email addresses captured on the coming-soon page so the
// organizer can email them when the site goes live. Idempotent table
// creation so we don't need a separate migration helper.
export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json() as { email?: string };
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), { status: 400 });
    }
    const normalized = email.trim().toLowerCase();
    if (normalized.length > 254) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), { status: 400 });
    }

    const db = getDB();
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS launch_notify (
        email TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      )
    `).run();
    await db.prepare(
      `INSERT INTO launch_notify (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING`
    ).bind(normalized, new Date().toISOString()).run();

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'save_failed' }), { status: 500 });
  }
};
