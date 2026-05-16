import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { validateSlug } from '../../../lib/profile-auth';

function gen6(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (arr[0] % 1_000_000).toString().padStart(6, '0');
}

async function sendCodeEmail(cfg: Record<string, string>, to: string, code: string, slug: string) {
  if (!cfg.resend_api_key) return;
  const subject = `Your Denver Social page code: ${code}`;
  const text = `Your 6-digit code to claim /u/${slug}:\n\n${code}\n\nExpires in 10 minutes.`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 12px">Your Denver Social page</h2>
      <p style="color:#555;margin:0 0 16px">Code to claim <strong>/u/${slug}</strong>:</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:700;padding:16px 24px;background:#EEF2FF;border:1px solid #C7D2FE;border-radius:12px;text-align:center;color:#4338CA">${code}</div>
      <p style="color:#888;font-size:13px;margin:16px 0 0">Expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
    </div>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.resend_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
        to, subject, text, html,
      }),
    });
  } catch {/* swallow — code is in DB */}
}

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'DB unavailable' }), { status: 500 });
  let body: any;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid body' }), { status: 400 }); }

  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const slug = v.slug;
  const email = (body?.email || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid email' }), { status: 400 });
  }

  // Always return ok to avoid leaking which slugs are taken.
  const existing = await db.prepare(`SELECT slug FROM profiles WHERE slug = ?`).bind(slug).first();
  if (!existing) {
    const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg: Record<string, string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
    const code = gen6();
    const now = Date.now();
    const expires = now + 10 * 60 * 1000;
    try {
      await db.prepare(
        `INSERT INTO profile_codes (slug, email, code, expires_at, used, created_at) VALUES (?,?,?,?,0,?)`
      ).bind(slug, email, code, expires, now).run();
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: 'DB insert failed' }), { status: 500 });
    }
    await sendCodeEmail(cfg, email, code, slug);
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
