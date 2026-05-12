// Discord OAuth — Step 2: handle callback, exchange code, set session
import { env } from "cloudflare:workers";
import { ensureMemberAuthSchema } from "../../../../lib/member-auth-schema";

function getDB(): D1Database | null {
  return (env as any).DB || null;
}

export const GET = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const DISCORD_CLIENT_ID = (env as any).DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = (env as any).DISCORD_CLIENT_SECRET;
  const url = new URL(request.url);
  const redirectUri = (env as any).DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;

  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  if (url.searchParams.get('error') || !code || !stateParam) {
    return new Response(null, { status: 302, headers: { 'Location': '/login?error=denied' } });
  }

  let statePayload: { csrf: string; next: string };
  try { statePayload = JSON.parse(atob(stateParam)); }
  catch { return new Response(null, { status: 302, headers: { 'Location': '/login?error=invalid_state' } }); }

  const storedCsrf = cookies.get('discord_state')?.value;
  if (!storedCsrf || storedCsrf !== statePayload.csrf) {
    return new Response(null, { status: 302, headers: { 'Location': '/login?error=csrf' } });
  }

  // Exchange code for access token
  let tokenData: any;
  try {
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    tokenData = await tokenRes.json();
  } catch {
    return new Response(null, { status: 302, headers: { 'Location': '/login?error=token_failed' } });
  }
  if (!tokenData?.access_token) {
    return new Response(null, { status: 302, headers: { 'Location': '/login?error=no_token' } });
  }

  // Fetch user
  let discordUser: any;
  try {
    const meRes = await fetch('https://discord.com/api/users/@me', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });
    discordUser = await meRes.json();
  } catch {
    return new Response(null, { status: 302, headers: { 'Location': '/login?error=fetch_failed' } });
  }

  const discordId: string = discordUser.id;
  const discordUsername: string = discordUser.global_name || discordUser.username || `user-${discordId}`;
  const discordEmail: string = (discordUser.email || `${discordId}@discord.local`).toLowerCase();
  const avatarUrl: string | null = discordUser.avatar
    ? `https://cdn.discordapp.com/avatars/${discordId}/${discordUser.avatar}.png?size=128`
    : null;

  const db = getDB();
  if (!db) return new Response(null, { status: 302, headers: { 'Location': '/login?error=db' } });
  await ensureMemberAuthSchema(db);

  const isConnect = !!(statePayload as any).connect;

  // Connect flow: link Discord to the currently-signed-in member.
  if (isConnect) {
    const userCookie = cookies.get('dsn_user')?.value;
    let currentUser: any = null;
    try { if (userCookie) currentUser = JSON.parse(userCookie); } catch {}
    if (!currentUser?.email) {
      return new Response(null, { status: 302, headers: { 'Location': '/login?error=not_signed_in' } });
    }
    const owner: any = await db.prepare("SELECT * FROM members WHERE discord_id = ?").bind(discordId).first();
    if (owner && owner.email.toLowerCase() !== currentUser.email.toLowerCase()) {
      return new Response(null, { status: 302, headers: { 'Location': '/profile?connect=discord_taken' } });
    }
    await db.prepare(
      "UPDATE members SET discord_id = ?, discord_username = ?, avatar_url = COALESCE(?, avatar_url) WHERE LOWER(email) = LOWER(?)"
    ).bind(discordId, discordUsername, avatarUrl, currentUser.email).run();
    const updated: any = await db.prepare("SELECT id, email, name, role, reddit_username FROM members WHERE LOWER(email) = LOWER(?)").bind(currentUser.email).first();
    const cookieVal = encodeURIComponent(JSON.stringify({
      id: updated?.id ?? currentUser.id,
      email: updated?.email ?? currentUser.email,
      name: updated?.name ?? currentUser.name,
      role: updated?.role ?? currentUser.role ?? 'member',
      reddit_username: updated?.reddit_username ?? currentUser.reddit_username,
      discord_username: discordUsername,
      avatar_url: avatarUrl,
      karma: currentUser.karma ?? 0,
    }));
    const headers = new Headers();
    headers.append('Location', '/profile?connect=discord_ok');
    headers.append('Set-Cookie', `dsn_user=${cookieVal}; Path=/; Max-Age=604800; SameSite=Lax`);
    headers.append('Set-Cookie', 'discord_state=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly');
    return new Response(null, { status: 302, headers });
  }

  // Find by discord_id first, then fall back to matching email so users
  // who already have a Reddit-backed account can link Discord.
  let member: any = await db.prepare("SELECT * FROM members WHERE discord_id = ?").bind(discordId).first();
  if (!member && discordEmail) {
    member = await db.prepare("SELECT * FROM members WHERE LOWER(email) = ?").bind(discordEmail).first();
    if (member) {
      await db.prepare("UPDATE members SET discord_id = ?, discord_username = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
        .bind(discordId, discordUsername, avatarUrl, member.id).run();
    }
  }

  if (!member) {
    await db.prepare(
      `INSERT INTO members (email, name, discord_id, discord_username, avatar_url, role, approved, onboarding_done)
       VALUES (?, ?, ?, ?, ?, 'member', 1, 0)`
    ).bind(discordEmail, discordUsername, discordId, discordUsername, avatarUrl).run();
    member = await db.prepare("SELECT * FROM members WHERE discord_id = ?").bind(discordId).first();
  } else {
    await db.prepare("UPDATE members SET discord_username = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
      .bind(discordUsername, avatarUrl, member.id).run();
  }

  const cookieVal = encodeURIComponent(JSON.stringify({
    id: member.id,
    email: member.email,
    name: discordUsername,
    role: member.role || 'member',
    discord_username: discordUsername,
    avatar_url: avatarUrl,
    karma: member.karma || 0,
  }));

  const nextUrl = statePayload.next || '/events';
  const isNewUser = !member.onboarding_done;
  const headers = new Headers();
  headers.append('Location', isNewUser ? '/onboarding/1' : nextUrl);
  headers.append('Set-Cookie', `dsn_user=${cookieVal}; Path=/; Max-Age=604800; SameSite=Lax`);
  headers.append('Set-Cookie', 'discord_state=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly');
  return new Response(null, { status: 302, headers });
};
