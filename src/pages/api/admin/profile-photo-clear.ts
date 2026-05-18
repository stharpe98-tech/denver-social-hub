// Admin-only: clear both cover_photo_url and avatar_photo_url for a
// profile and delete the R2 objects. The profile row itself stays put.

import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { env } from 'cloudflare:workers';
import { isAdmin as isAdminCookie } from '../../../lib/admin-auth';
import { clearProfilePhotos } from '../../../lib/profile-cleanup';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await isAdminCookie(cookies))) {
    return new Response(JSON.stringify({ ok: false, error: 'not_authorized' }), { status: 403 });
  }
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db_unavailable' }), { status: 500 });

  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'invalid_body' }), { status: 400 }); }

  const slug = (body?.slug || '').toString().trim().toLowerCase();
  if (!slug) return new Response(JSON.stringify({ ok: false, error: 'missing_slug' }), { status: 400 });

  const result = await clearProfilePhotos(db, env, slug);
  if (result.notFound) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  return new Response(JSON.stringify({
    ok: true,
    slug,
    errors: result.errors.length ? result.errors : undefined,
  }), { headers: { 'Content-Type': 'application/json' } });
};
