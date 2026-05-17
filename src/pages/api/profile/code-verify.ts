import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { clearProfileCookie, getCurrentProfile, setProfileCookie, validateSlug } from '../../../lib/profile-auth';
import { setAdminCookie, getAllowedAdminEmails } from '../../../lib/admin-auth';

// Auto-elevate to admin if this email is on config.admin_emails. Called
// from every success branch so signing up via /profile/new also surfaces
// the Admin nav link without a separate /admin/login round-trip.
async function maybeElevate(db: D1Database, cookies: any, email: string): Promise<void> {
  try {
    const allowed = await getAllowedAdminEmails(db);
    if (allowed.some(a => a.toLowerCase() === email.toLowerCase())) {
      await setAdminCookie({ cookies } as any, email);
    }
  } catch { /* non-fatal */ }
}

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

  // Detect "upgrade" — existing regular session for this email.
  const existingMe = await getCurrentProfile(cookies, db, request);
  const isUpgrade = !!(existingMe && existingMe.tier === 'regular' && existingMe.email === email);
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

  if (isUpgrade && existingMe && !existing) {
    // Upgrade path: flip the regular profile row to the new slug + organizer tier.
    try {
      await db.prepare(
        `UPDATE profiles SET slug = ?, tier = 'organizer', updated_at = datetime('now') WHERE slug = ?`
      ).bind(slug, existingMe.slug).run();
    } catch (e: any) {
      return new Response(JSON.stringify({ ok: false, error: 'Upgrade failed: ' + (e?.message || 'db') }), { status: 500 });
    }
    clearProfileCookie({ cookies } as any, existingMe.slug);
    await setProfileCookie({ cookies } as any, slug);
    await maybeElevate(db, cookies, email);
    return new Response(JSON.stringify({ ok: true, redirect: `/u/${slug}/edit` }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const isNewProfile = !existing;
  if (!existing) {
    const displayName = (email.split('@')[0] || slug).slice(0, 60);
    // Try the full insert (with tier + id). If the schema is older, retry without optional columns.
    try {
      await db.prepare(
        `INSERT INTO profiles (id, slug, display_name, email, status, tier, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'live', 'organizer', datetime('now'), datetime('now'))`
      ).bind(slug, slug, displayName, email).run();
    } catch {
      try {
        await db.prepare(
          `INSERT INTO profiles (slug, display_name, email, status, tier, created_at, updated_at)
           VALUES (?, ?, ?, 'live', 'organizer', ?, ?)`
        ).bind(slug, displayName, email, now, now).run();
      } catch {
        await db.prepare(
          `INSERT INTO profiles (slug, display_name, email, status, created_at, updated_at)
           VALUES (?,?,?, 'live', ?, ?)`
        ).bind(slug, displayName, email, now, now).run();
      }
    }
  }
  await setProfileCookie({ cookies } as any, slug);
  await maybeElevate(db, cookies, email);
  const redirect = isNewProfile ? `/u/${slug}/welcome` : `/u/${slug}/edit`;
  return new Response(JSON.stringify({ ok: true, redirect }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
