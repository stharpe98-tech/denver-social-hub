// Verify a regular sign-up code, mint a random slug, create the profile
// row with tier='regular', set the dsn_profile_<slug> cookie.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { generateRegularSlug, setProfileCookie } from '../../../lib/profile-auth';
import { setAdminCookie, getAllowedAdminEmails } from '../../../lib/admin-auth';

function pendingSlugFor(email: string): string {
  return `r-pending-${email}`.slice(0, 80);
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const email = (body?.email || '').toString().trim().toLowerCase();
  const code = (body?.code || '').toString().trim();
  const name = ((body?.name || '').toString().trim() || (email.split('@')[0] || 'Member')).slice(0, 60);
  if (!email || !email.includes('@') || !/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email or code' }), { status: 400 });
  }

  const now = Date.now();
  const row: any = await db.prepare(
    `SELECT rowid AS id, expires_at, used FROM profile_codes
     WHERE slug = ? AND email = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(pendingSlugFor(email), email, code, now).first();
  if (!row) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code' }), { status: 401 });
  }
  await db.prepare(`UPDATE profile_codes SET used = 1 WHERE rowid = ?`).bind(row.id).run();

  // If this email already has a profile (regular), reuse it.
  const existing: any = await db.prepare(
    `SELECT slug, tier FROM profiles WHERE LOWER(email) = ? LIMIT 1`
  ).bind(email).first();
  let slug: string;
  if (existing) {
    slug = existing.slug;
  } else {
    // Mint a unique random slug. Retry a couple of times on collision.
    slug = generateRegularSlug();
    let attempts = 0;
    while (attempts < 5) {
      try {
        await db.prepare(
          `INSERT INTO profiles (id, slug, display_name, email, status, tier, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'live', 'regular', datetime('now'), datetime('now'))`
        ).bind(slug, slug, name, email).run();
        break;
      } catch (e: any) {
        const msg = String(e?.message || '');
        if (msg.includes('UNIQUE') || msg.includes('constraint')) {
          slug = generateRegularSlug();
          attempts++;
          continue;
        }
        return new Response(JSON.stringify({ ok: false, error: 'DB insert failed: ' + msg }), { status: 500 });
      }
    }
    if (attempts >= 5) {
      return new Response(JSON.stringify({ ok: false, error: 'Could not mint slug' }), { status: 500 });
    }
  }

  await setProfileCookie({ cookies } as any, slug);
  // Auto-elevate to admin if this email is on the allowlist.
  try {
    const allowed = await getAllowedAdminEmails(db);
    if (allowed.some(a => a.toLowerCase() === email.toLowerCase())) {
      await setAdminCookie({ cookies } as any, email);
    }
  } catch { /* non-fatal */ }
  return new Response(JSON.stringify({ ok: true, redirect: '/profile' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
