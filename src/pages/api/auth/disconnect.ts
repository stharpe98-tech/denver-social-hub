// Disconnect a linked auth identity (reddit or discord) from the
// signed-in member. Refuses if the identity is the only thing tying
// the account together with a real address — i.e. you can't remove the
// last sign-in path.
import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) {
    return new Response(JSON.stringify({ ok: false, error: 'not_signed_in' }), { status: 401 });
  }

  const { provider } = await request.json().catch(() => ({})) as { provider?: string };
  if (provider !== 'reddit' && provider !== 'discord') {
    return new Response(JSON.stringify({ ok: false, error: 'bad_provider' }), { status: 400 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db' }), { status: 500 });

  const member: any = await db.prepare("SELECT * FROM members WHERE LOWER(email) = LOWER(?)").bind(user.email).first();
  if (!member) {
    return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
  }

  // Refuse to remove the only remaining sign-in method. Reddit/discord
  // email may be a synthetic local-part — treat reddit.local / discord.local
  // as "no real email" so we don't strand the account.
  const hasRealEmail = member.email && !/@reddit\.local$/i.test(member.email) && !/@discord\.local$/i.test(member.email);
  const otherProviderConnected = provider === 'reddit' ? !!member.discord_id : !!member.reddit_id;
  if (!hasRealEmail && !otherProviderConnected) {
    return new Response(JSON.stringify({ ok: false, error: 'last_method' }), { status: 400 });
  }

  if (provider === 'reddit') {
    await db.prepare(
      "UPDATE members SET reddit_id = NULL, reddit_username = NULL, karma = 0, reddit_account_created = NULL WHERE id = ?"
    ).bind(member.id).run();
  } else {
    await db.prepare(
      "UPDATE members SET discord_id = NULL, discord_username = NULL WHERE id = ?"
    ).bind(member.id).run();
  }

  // Refresh session cookie so the linked identity disappears from the UI
  const updated: any = await db.prepare("SELECT id, email, name, role, reddit_username, discord_username, karma, avatar_url FROM members WHERE id = ?").bind(member.id).first();
  const sessionVal = encodeURIComponent(JSON.stringify({
    id: updated.id, email: updated.email, name: updated.name, role: updated.role || 'member',
    reddit_username: updated.reddit_username || null,
    discord_username: updated.discord_username || null,
    karma: updated.karma || 0,
    avatar_url: updated.avatar_url || null,
  }));
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `dsn_user=${sessionVal}; Path=/; Max-Age=2592000; SameSite=Lax`,
    },
  });
};
