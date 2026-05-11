// Member email magic code — Step 1: send a 6-digit OTP via Resend.
// Always responds with {ok:true} so this endpoint can't be used to
// probe whether an email belongs to a registered member.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureMemberAuthSchema, getResendConfig } from '../../../lib/member-auth-schema';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json() as { email?: string };
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_email' }), { status: 400 });
    }
    const normalized = email.trim().toLowerCase();
    const db = getDB();
    if (!db) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    await ensureMemberAuthSchema(db);
    const cfg = await getResendConfig(db);
    if (!cfg) {
      return new Response(JSON.stringify({ ok: false, error: 'email_not_configured' }), { status: 500 });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expires = now + 10 * 60 * 1000;
    await db.prepare("DELETE FROM member_magic_tokens WHERE email = ?").bind(normalized).run();
    await db.prepare("INSERT INTO member_magic_tokens (token, email, expires, created_at) VALUES (?,?,?,?)")
      .bind(otp, normalized, expires, now).run();

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        from: cfg.from,
        to: [normalized],
        subject: `Your Denver Social sign-in code: ${otp}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;">
            <h2 style="font-size:22px;font-weight:900;margin-bottom:8px;color:#111">Denver Social</h2>
            <p style="color:#888;margin-bottom:32px;font-size:14px">Your sign-in code:</p>
            <div style="background:#E0F2FE;border-radius:16px;padding:32px;text-align:center;margin-bottom:32px;">
              <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#0EA5E9;">${otp}</div>
            </div>
            <p style="color:#888;font-size:13px;">This code expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    }).catch(() => {});

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'send_failed' }), { status: 500 });
  }
};
