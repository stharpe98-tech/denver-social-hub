import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';
import { ensureOrgSchema } from '../../lib/admin-auth';

export const prerender = false;

// Sends a 6-digit OTP to any approved organizer's email. Always returns
// {ok:true} so the endpoint can't be used to enumerate which emails are
// approved organizers.
export async function POST({ request }: APIContext) {
  try {
    const { email } = await request.json() as { email?: string };
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 });
    }
    const normalizedEmail = email.trim().toLowerCase();

    const db = getDB();
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    await ensureOrgSchema(db);

    // Only approved organizers get a code. Don't leak which emails qualify.
    const org = await db.prepare(
      "SELECT id FROM organizers WHERE LOWER(email) = ? AND approved_for_potlucks = 1"
    ).bind(normalizedEmail).first();
    if (!org) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    const cfgRows = await db.prepare("SELECT key, value FROM config").all();
    const cfg: Record<string, string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
    if (!cfg.resend_api_key) {
      return new Response(JSON.stringify({ ok: false, error: 'email_not_configured' }), { status: 500 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;

    await db.prepare(
      "CREATE TABLE IF NOT EXISTS magic_tokens (token TEXT PRIMARY KEY, email TEXT, expires INTEGER)"
    ).run();
    // Clear any pending tokens for this email so resend works cleanly.
    await db.prepare("DELETE FROM magic_tokens WHERE email = ?").bind(normalizedEmail).run();
    await db.prepare(
      "INSERT INTO magic_tokens (token, email, expires) VALUES (?, ?, ?)"
    ).bind(otp, normalizedEmail, expires).run();

    const fromEmail = cfg.from_email || 'Denver Social <onboarding@resend.dev>';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.resend_api_key}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [normalizedEmail],
        subject: `Your admin code: ${otp}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;">
            <h2 style="font-size:22px;font-weight:900;margin-bottom:8px;color:#111">Denver Social Admin</h2>
            <p style="color:#888;margin-bottom:32px;font-size:14px">Your admin login code:</p>
            <div style="background:#F0F6FC;border-radius:16px;padding:32px;text-align:center;margin-bottom:32px;">
              <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#F05A28;">${otp}</div>
            </div>
            <p style="color:#888;font-size:13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to send code' }), { status: 500 });
  }
}
