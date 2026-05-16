import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { canEditProfile, validateSlug } from '../../../lib/profile-auth';

const ALLOWED_FIELDS = new Set([
  'display_name', 'headline', 'bio', 'photo_emoji', 'accent_color',
  'offers_json', 'links_json', 'contact_email', 'contact_phone',
]);

const ACCENT_RE = /^#[0-9A-Fa-f]{6}$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }
  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const slug = v.slug;
  if (!(await canEditProfile(cookies, slug))) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authorized' }), { status: 401 });
  }
  const field = (body?.field || '').toString();
  if (!ALLOWED_FIELDS.has(field)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid field' }), { status: 400 });
  }
  let value = body?.value;
  if (value === undefined || value === null) value = '';
  value = value.toString();
  // Length caps
  const caps: Record<string, number> = {
    display_name: 80, headline: 140, bio: 2000, photo_emoji: 16,
    accent_color: 16, offers_json: 4000, links_json: 4000,
    contact_email: 120, contact_phone: 40,
  };
  if (value.length > (caps[field] || 1000)) {
    return new Response(JSON.stringify({ ok: false, error: 'Too long' }), { status: 400 });
  }
  if (field === 'accent_color' && !ACCENT_RE.test(value)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid color' }), { status: 400 });
  }
  if (field === 'offers_json' || field === 'links_json') {
    try { JSON.parse(value); } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { status: 400 });
    }
  }
  if (field === 'display_name' && !value.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'Name required' }), { status: 400 });
  }
  const now = Date.now();
  await db.prepare(
    `UPDATE profiles SET ${field} = ?, updated_at = ? WHERE slug = ?`
  ).bind(value, now, slug).run();
  return new Response(JSON.stringify({ ok: true, at: now }), { headers: { 'Content-Type': 'application/json' } });
};
