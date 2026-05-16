import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { setProfileCookie, validateSlug } from '../../../lib/profile-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }
  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const slug = v.slug;
  const email = (body?.email || '').toString().trim().toLowerCase();
  const code = (body?.code || '').toString().trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email or code' }), { status: 400 });
  }
  const now = Date.now();
  const row = await db.prepare(
    `SELECT rowid AS id, expires_at, used FROM profile_codes
     WHERE slug = ? AND email = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(slug, email, code, now).first() as any;
  if (!row) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), { status: 401 });
  }
  // Check whether profile already exists (edit re-auth flow)
  const existing = await db.prepare(`SELECT slug FROM profiles WHERE slug = ?`).bind(slug).first();
  await db.prepare(`UPDATE profile_codes SET used = 1 WHERE rowid = ?`).bind(row.id).run();
  if (!existing) {
    const displayName = (email.split('@')[0] || slug).slice(0, 60);
    await db.prepare(
      `INSERT INTO profiles (slug, display_name, email, status, created_at, updated_at)
       VALUES (?,?,?, 'live', ?, ?)`
    ).bind(slug, displayName, email, now, now).run();
  }
  await setProfileCookie({ cookies } as any, slug);
  return new Response(JSON.stringify({ ok: true, redirect: `/u/${slug}/edit` }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
