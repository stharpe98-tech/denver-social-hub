import { env } from "cloudflare:workers";

export const GET = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) {
    return Response.redirect(`${origin}/login?error=discord_cancelled`, 302);
  }

  const clientId     = (env as any).DISCORD_CLIENT_ID;
  const clientSecret = (env as any).DISCORD_CLIENT_SECRET;
  const redirectUri  = `${origin}/auth/discord/callback`;
  const db           = (env as any).DB;

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return Response.redirect(`${origin}/login?error=discord_token`, 302);
    }

    const tokenData: any = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Get Discord user info
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      return Response.redirect(`${origin}/login?error=discord_user`, 302);
    }

    const discordUser: any = await userRes.json();
    const email    = discordUser.email;
    const name     = discordUser.global_name || discordUser.username;
    const avatar   = discordUser.avatar
      ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`
      : null;

    if (!email) {
      return Response.redirect(`${origin}/login?error=discord_no_email`, 302);
    }

    if (!db) {
      return Response.redirect(`${origin}/login?error=db`, 302);
    }

    // Check if member exists
    let member: any = await db.prepare("SELECT * FROM members WHERE email=?").bind(email).first();
    let isNew = false;

    if (!member) {
      // Create new member
      await db.prepare(
        "INSERT INTO members (email, name, bio, neighborhood) VALUES (?, ?, '', '') ON CONFLICT(email) DO NOTHING"
      ).bind(email, name).run();
      member = await db.prepare("SELECT * FROM members WHERE email=?").bind(email).first();
      isNew = true;
    }

    // Save avatar if we have one and member doesn't have one
    if (avatar) {
      try {
        await db.prepare("UPDATE members SET avatar_url=? WHERE email=? AND (avatar_url IS NULL OR avatar_url='')").bind(avatar, email).run();
      } catch {}
    }

    const cookieVal = encodeURIComponent(JSON.stringify({ id: member?.id, email, name: member?.name || name, role: member?.role || 'member' }));
    const destination = isNew ? "/onboarding/1" : "/events";

    return new Response(null, {
      status: 302,
      headers: {
        "Location": destination,
        "Set-Cookie": `dsn_user=${cookieVal}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    });
  } catch (e: any) {
    return Response.redirect(`${origin}/login?error=discord_unknown`, 302);
  }
};
