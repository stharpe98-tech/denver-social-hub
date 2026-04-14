import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';
import { env } from 'cloudflare:workers';

export const prerender = false;

export async function POST({ request }: APIContext) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== 'stharpe98@gmail.com') {
      // Still return success to avoid leaking admin email
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store OTP in D1
    const db = getDB();
    if (db) {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS magic_tokens (token TEXT PRIMARY KEY, email TEXT, expires INTEGER)`
      ).run();
      await db.prepare(
        `INSERT OR REPLACE INTO magic_tokens (token, email, expires) VALUES (?, ?, ?)`
      ).bind(otp, normalizedEmail, expires).run();
    }

    const RESEND_API_KEY = (env as any).RESEND_API_KEY;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Denver Social Nights <onboarding@resend.dev>',
        to: [normalizedEmail],
        subject: `Your admin code: ${otp}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;">
            <h2 style="font-size:22px;font-weight:900;margin-bottom:8px;color:#111">Denver Social Nights</h2>
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
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to send code' }), { status: 500 });
  }
}
