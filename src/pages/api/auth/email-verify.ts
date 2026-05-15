// Member email magic code — Step 2: verify the 6-digit OTP and sign in.
// Creates a member record if no account exists for the email yet so the
// same endpoint handles both sign-in and passwordless signup.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureMemberAuthSchema } from '../../../lib/member-auth-schema';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email, code, next } = await request.json() as { email?: string; code?: string; next?: string };
    if (!email || !code) {
      return new Response(JSON.stringify({ ok: false, error: 'missing' }), { status: 400 });
    }
    const normalized = email.trim().toLowerCase();
    const db = getDB();
    if (!db) return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });
    await ensureMemberAuthSchema(db);

    const row: any = await db.prepare("SELECT * FROM member_magic_tokens WHERE token = ? AND email = ?")
      .bind(code.toString(), normalized).first();
    if (!row) {
      return new Response(JSON.stringify({ ok: false, error: 'wrong_code' }), { status: 400 });
    }
    if (Date.now() > row.expires) {
      await db.prepare("DELETE FROM member_magic_tokens WHERE token = ?").bind(code).run();
      return new Response(JSON.stringify({ ok: false, error: 'expired' }), { status: 400 });
    }

    await db.prepare("DELETE FROM member_magic_tokens WHERE email = ?").bind(normalized).run();

    let member: any = await db.prepare("SELECT * FROM members WHERE LOWER(email) = ?").bind(normalized).first();
    let isNewUser = false;
    if (!member) {
      const nameGuess = normalized.split('@')[0];
      await db.prepare(
        `INSERT INTO members (email, name, role, approved, onboarding_done)
         VALUES (?, ?, 'member', 1, 0)`
      ).bind(normalized, nameGuess).run();
      member = await db.prepare("SELECT * FROM members WHERE LOWER(email) = ?").bind(normalized).first();
      isNewUser = true;
    } else {
      isNewUser = !member.onboarding_done;
    }

    const cookieVal = encodeURIComponent(JSON.stringify({
      id: member.id,
      email: member.email,
      name: member.name || member.reddit_username || member.discord_username,
      role: member.role || 'member',
      karma: member.karma || 0,
    }));

    return new Response(JSON.stringify({ ok: true, redirect: isNewUser ? '/onboarding/1' : (next || '/events') }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `dsn_user=${cookieVal}; Path=/; Max-Age=2592000; SameSite=Lax`,
      },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'failed' }), { status: 500 });
  }
};
