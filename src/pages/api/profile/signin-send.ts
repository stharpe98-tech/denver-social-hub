// Sign-in via email only. Looks up the profile by email (regular OR
// organizer), generates a 6-digit code, stores it in profile_codes
// against that profile's slug, emails it. Always returns ok so we
// don't leak which emails are registered.

import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { buildCodeEmail } from '../../../lib/email';

function gen6(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, '0');
}

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });

  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const email = (body?.email || '').toString().trim().toLowerCase();
  if (!email || email.indexOf('@') < 0) {
    return new Response(JSON.stringify({ ok: false, error: 'Enter a valid email.' }), { status: 400 });
  }

  // Look up profile by email. If multiple, we'll just take the most
  // recent one — multi-profile-per-email is a rare edge case.
  const profile = await db.prepare(
    `SELECT slug FROM profiles WHERE LOWER(email) = ? ORDER BY created_at DESC LIMIT 1`
  ).bind(email).first() as any;

  // Always return ok to avoid enumeration.
  if (profile?.slug) {
    const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg: Record<string, string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });

    const code = gen6();
    const now = Date.now();
    const expires = now + 10 * 60 * 1000;
    try {
      await db.prepare(
        `INSERT INTO profile_codes (slug, email, code, expires_at, used, created_at) VALUES (?,?,?,?,0,?)`
      ).bind(profile.slug, email, code, expires, now).run();
    } catch {
      // Even if insert fails, return ok — don't leak.
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    if (cfg.resend_api_key) {
      const subject = `Sign in to Denver Social: ${code}`;
      const html = buildCodeEmail({ code, purpose: 'sign in to Denver Social', minutes: 10 });
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cfg.from_email || 'Denver Social Hub <hello@denversocialhub.com>',
            to: [email],
            subject,
            html,
          }),
        });
      } catch { /* non-blocking */ }
    }
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
