// Send a 6-digit code to an email so they can finish creating a
// "regular" profile (no public page). The slug stored in profile_codes
// is the placeholder `r-pending-<email>` — the real random slug is
// minted on verify.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';

function gen6(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, '0');
}

async function sendCodeEmail(cfg: Record<string, string>, to: string, code: string) {
  if (!cfg.resend_api_key) return;
  const subject = `Your Denver Social code: ${code}`;
  const text = `Your 6-digit code to finish signing up:\n\n${code}\n\nExpires in 10 minutes.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px">Welcome to Denver Social</h2>
      <p style="color:#555;margin:0 0 16px">Your 6-digit code:</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:16px 24px;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;text-align:center;color:#4338CA">${code}</div>
      <p style="color:#888;font-size:13px;margin:16px 0 0">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
    </div>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
        to, subject, text, html,
      }),
    });
  } catch {/* swallow — code is in DB */}
}

function pendingSlugFor(email: string): string {
  // Stable, predictable placeholder so verify can find the row by email.
  return `r-pending-${email}`.slice(0, 80);
}

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const email = (body?.email || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), { status: 400 });
  }

  // If an organizer profile already owns this email, point them at the
  // organizer code flow instead.
  const existingOrganizer: any = await db.prepare(
    `SELECT slug, tier FROM profiles WHERE LOWER(email) = ? AND tier='organizer' LIMIT 1`
  ).bind(email).first();
  if (existingOrganizer) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'You already have an Organizer page. Visit /u/' + existingOrganizer.slug + '/edit.',
    }), { status: 400 });
  }

  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  const code = gen6();
  const now = Date.now();
  const expires = now + 10 * 60 * 1000;
  try {
    await db.prepare(
      `INSERT INTO profile_codes (slug, email, code, expires_at, used, created_at) VALUES (?,?,?,?,0,?)`
    ).bind(pendingSlugFor(email), email, code, expires, now).run();
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: 'DB insert failed' }), { status: 500 });
  }
  await sendCodeEmail(cfg, email, code);
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
