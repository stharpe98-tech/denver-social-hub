// Verifies a sign-in code that was sent via /api/profile/signin-send.
// User provides email + code; we look up the matching unused, unexpired
// row in profile_codes (no slug needed — sign-in finds your profile
// for you), mark it used, set the dsn_profile_<slug> cookie, redirect.

import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { setProfileCookie } from '../../../lib/profile-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });

  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const email = (body?.email || '').toString().trim().toLowerCase();
  const code = (body?.code || '').toString().trim();
  if (!email || email.indexOf('@') < 0) {
    return new Response(JSON.stringify({ ok: false, error: 'Enter a valid email.' }), { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return new Response(JSON.stringify({ ok: false, error: 'Enter the 6-digit code.' }), { status: 400 });
  }

  const now = Date.now();
  const row = await db.prepare(
    `SELECT rowid AS id, slug FROM profile_codes
     WHERE email = ? AND code = ? AND used = 0 AND expires_at > ?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(email, code, now).first() as any;

  if (!row?.slug) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid or expired code.' }), { status: 401 });
  }

  // Confirm the slug still points to a profile owned by this email.
  const profile = await db.prepare(
    `SELECT slug, tier FROM profiles WHERE slug = ? AND LOWER(email) = ? LIMIT 1`
  ).bind(row.slug, email).first() as any;

  if (!profile?.slug) {
    return new Response(JSON.stringify({ ok: false, error: 'Account not found.' }), { status: 404 });
  }

  await db.prepare(`UPDATE profile_codes SET used = 1 WHERE rowid = ?`).bind(row.id).run();
  await setProfileCookie({ cookies } as any, profile.slug);

  // Organizers go to their editor; regulars go to /profile.
  const redirect = profile.tier === 'organizer' ? `/u/${profile.slug}/edit` : '/profile';
  return new Response(JSON.stringify({ ok: true, redirect, tier: profile.tier }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
