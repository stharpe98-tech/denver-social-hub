import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { validateSlug } from '../../../lib/profile-auth';
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
  const v = validateSlug(body?.slug || '');
  if (!v.ok) return new Response(JSON.stringify({ ok: false, error: v.error }), { status: 400 });
  const slug = v.slug;

  const profile = await db.prepare(`SELECT email FROM profiles WHERE slug = ?`).bind(slug).first() as any;
  // Always return ok — don't leak which slugs exist.
  if (profile?.email) {
    const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg: Record<string, string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
    const code = gen6();
    const now = Date.now();
    const expires = now + 10 * 60 * 1000;
    try {
      await db.prepare(
        `INSERT INTO profile_codes (slug, email, code, expires_at, used, created_at) VALUES (?,?,?,?,0,?)`
      ).bind(slug, profile.email, code, expires, now).run();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'DB insert failed' }), { status: 500 });
    }
    if (cfg.resend_api_key) {
      const subject = `Edit your Denver Social page: ${code}`;
      const html = buildCodeEmail({ code, purpose: `edit your page /u/${slug}`, minutes: 10 });
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cfg.resend_api_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
            to: profile.email,
            subject,
            text: `Code to edit /u/${slug}: ${code} (expires in 10 minutes)`,
            html,
          }),
        });
      } catch {/* swallow */}
    }
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
