import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { canEditProfileOrAdmin, validateSlug } from '../../../lib/profile-auth';
import { isOrganizerPresetKey } from '../../../lib/organizer-themes';
import { ensureProfileThemeColumn } from '../../../lib/profile-theme-schema';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });

  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const slug = v.slug;

  if (!(await canEditProfileOrAdmin(cookies, slug))) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authorized' }), { status: 401 });
  }

  // null / '' / missing → clear the preset back to Standard.
  const raw = body?.preset;
  let preset: string | null;
  if (raw === null || raw === undefined || raw === '') {
    preset = null;
  } else if (isOrganizerPresetKey(raw)) {
    preset = raw;
  } else {
    return new Response(JSON.stringify({ ok: false, error: 'Unknown preset' }), { status: 400 });
  }

  await ensureProfileThemeColumn(db);

  try {
    await db.prepare(
      `UPDATE profiles SET theme_preset = ?, updated_at = ? WHERE slug = ?`
    ).bind(preset, Date.now(), slug).run();
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || 'DB error' }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, preset }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const ALL: APIRoute = async ({ request }) => {
  if (request.method === 'POST') return new Response(null, { status: 405 });
  return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
    status: 405,
    headers: { 'Content-Type': 'application/json', Allow: 'POST' },
  });
};
