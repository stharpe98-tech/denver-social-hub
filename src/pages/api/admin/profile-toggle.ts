import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin-auth';
import { validateSlug } from '../../../lib/profile-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAdmin(cookies))) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authorized' }), { status: 401 });
  }
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }
  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const status = (body?.status || '').toString();
  if (status !== 'live' && status !== 'offline') {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid status' }), { status: 400 });
  }
  await db.prepare(
    `UPDATE profiles SET status = ?, updated_at = ? WHERE slug = ?`
  ).bind(status, Date.now(), v.slug).run();
  return new Response(JSON.stringify({ ok: true, status }), { headers: { 'Content-Type': 'application/json' } });
};
