// Permanently delete a /u/[slug] profile + everything tied to it.
// Admin-only. Removes:
//   - profile row
//   - profile_codes (auth codes)
//   - profile_reports (flagged reports)
//   - bookable_offerings + their offering_availability + blackouts
//   - bookings tied to this profile
//   - R2 images (cover_photo_url + avatar_photo_url)
//
// Anonymizes (keeps the content but drops the link):
//   - favors (community board flyers): clears member_email so the flyer
//     survives but no longer points at this profile
//   - events (submitted_by_email): same — flyers/events stay public
//   - group posts: leaves them; we don't want to nuke community content
//
// The route returns { ok, deleted, errors[] }. Errors don't abort the
// rest of the cascade; we capture them and keep going so a partial DB
// state is still cleaned up as much as possible.

import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { env } from 'cloudflare:workers';
import { isAdmin as isAdminCookie } from '../../../lib/admin-auth';

export const prerender = false;

function r2KeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Our images are served from /api/profile/img/u/<slug>/<filename>
  const m = /\/api\/profile\/img\/(u\/[A-Za-z0-9_\-\/.]+)$/.exec(url);
  return m ? m[1] : null;
}

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
  const confirm = (body?.confirm || '').toString().trim();
  if (!slug) return new Response(JSON.stringify({ ok: false, error: 'missing_slug' }), { status: 400 });

  // Belt + suspenders: client must echo the slug to confirm.
  if (confirm !== slug) {
    return new Response(JSON.stringify({ ok: false, error: 'confirm_mismatch', hint: `confirm must equal "${slug}"` }), { status: 400 });
  }

  // Fetch what we need before we start deleting.
  let profile: any = null;
  try {
    profile = await db.prepare(
      `SELECT slug, email, cover_photo_url, avatar_photo_url FROM profiles WHERE slug = ?`
    ).bind(slug).first();
  } catch {
    profile = await db.prepare(`SELECT slug, email FROM profiles WHERE slug = ?`).bind(slug).first();
  }
  if (!profile) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  const errors: string[] = [];

  // Delete R2 objects (cover + avatar). Non-fatal if R2 is unavailable.
  try {
    const uploads: any = (env as any)?.UPLOADS;
    if (uploads) {
      for (const url of [profile.cover_photo_url, profile.avatar_photo_url]) {
        const key = r2KeyFromUrl(url);
        if (key) { try { await uploads.delete(key); } catch (e: any) { errors.push(`r2 ${key}: ${e?.message || 'err'}`); } }
      }
    }
  } catch (e: any) { errors.push(`r2 lookup: ${e?.message || 'err'}`); }

  // Helper to run a delete with try/catch (table may not exist on stale envs).
  async function safeRun(sql: string, ...binds: any[]) {
    try { await db.prepare(sql).bind(...binds).run(); }
    catch (e: any) { errors.push(`${sql.slice(0, 40)}…: ${e?.message || 'err'}`); }
  }

  // Auth codes
  await safeRun(`DELETE FROM profile_codes WHERE slug = ?`, slug);
  // Reports
  await safeRun(`DELETE FROM profile_reports WHERE slug = ?`, slug);
  // Bookings (and related per-offering rows)
  try {
    const offerings = (await db.prepare(
      `SELECT id FROM bookable_offerings WHERE profile_slug = ?`
    ).bind(slug).all())?.results || [];
    const ids = (offerings as any[]).map(o => o.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      await safeRun(`DELETE FROM offering_availability WHERE offering_id IN (${placeholders})`, ...ids);
      await safeRun(`DELETE FROM offering_blackouts WHERE offering_id IN (${placeholders})`, ...ids);
    }
  } catch (e: any) { errors.push(`offerings lookup: ${e?.message || 'err'}`); }
  await safeRun(`DELETE FROM bookings WHERE profile_slug = ?`, slug);
  await safeRun(`DELETE FROM bookable_offerings WHERE profile_slug = ?`, slug);

  // Anonymize community content tied to this profile's email. Keeps the
  // flyers/events visible but breaks the link to the deleted account.
  const email = (profile.email || '').toLowerCase();
  if (email) {
    await safeRun(`UPDATE favors SET member_email = '' WHERE LOWER(member_email) = ?`, email);
    await safeRun(`UPDATE events SET submitted_by_email = '' WHERE LOWER(submitted_by_email) = ?`, email);
  }

  // Finally, the profile row itself.
  await safeRun(`DELETE FROM profiles WHERE slug = ?`, slug);

  return new Response(JSON.stringify({
    ok: true,
    deleted: slug,
    errors: errors.length ? errors : undefined,
  }), { headers: { 'Content-Type': 'application/json' } });
};
