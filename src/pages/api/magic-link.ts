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

    // Generate a secure token
    const token = crypto.randomUUID() + '-' + crypto.randomUUID();
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store token in D1
    const db = getDB();
    if (db) {
      await db.prepare(
        `CREATE TABLE IF NOT EXISTS magic_tokens (token TEXT PRIMARY KEY, email TEXT, expires INTEGER)`
      ).run();
      await db.prepare(
        `INSERT OR REPLACE INTO magic_tokens (token, email, expires) VALUES (?, ?, ?)`
      ).bind(token, normalizedEmail, expires).run();
    }

    const RESEND_API_KEY = (env as any).RESEND_API_KEY;
    const siteUrl = 'https://denver-social-hub.stharpe98.workers.dev';
    const magicLink = `${siteUrl}/admin/verify?token=${token}`;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Denver Social Nights <onboarding@resend.dev>',
        to: [normalizedEmail],
        subject: 'Your admin login link',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#0f0f12;color:#f0f0f0;border-radius:16px">
            <h2 style="font-size:22px;font-weight:900;margin-bottom:8px;color:#fff">Denver Social Nights</h2>
            <p style="color:#888;margin-bottom:32px;font-size:14px">Admin access requested</p>
            <a href="${magicLink}" style="display:inline-block;background:#F05A28;color:#fff;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:700;font-size:15px;margin-bottom:24px">
              Sign In as Admin →
            </a>
            <p style="color:#555;font-size:12px;margin-top:24px">This link expires in 15 minutes. If you didn't request this, ignore this email.</p>
          </div>
        `,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to send link' }), { status: 500 });
  }
}
