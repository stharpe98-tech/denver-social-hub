import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { validateSlug } from '../../../lib/profile-auth';

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }
  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const reason = (body?.reason || '').toString().slice(0, 500);
  const profile = await db.prepare(`SELECT slug FROM profiles WHERE slug = ?`).bind(v.slug).first();
  if (!profile) return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  await db.prepare(
    `INSERT INTO profile_reports (slug, reason, created_at) VALUES (?,?,?)`
  ).bind(v.slug, reason, Date.now()).run();
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
