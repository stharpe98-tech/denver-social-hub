// Reddit OAuth — Step 2: handle callback, exchange code for token, fetch user info
import { env } from "cloudflare:workers";

function getDB(): D1Database | null {
  return (env as any).DB || null;
}

export const GET = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const REDDIT_CLIENT_ID = (env as any).REDDIT_CLIENT_ID;
  const REDDIT_CLIENT_SECRET = (env as any).REDDIT_CLIENT_SECRET;
  const REDDIT_REDIRECT_URI = (env as any).REDDIT_REDIRECT_URI || 'https://denversocialhub.com/api/auth/reddit/callback';

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // User denied or error
  if (error || !code || !stateParam) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=denied' }
    });
  }

  // Verify CSRF state
  let statePayload: { csrf: string; next: string };
  try {
    statePayload = JSON.parse(atob(stateParam));
  } catch {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=invalid_state' }
    });
  }

  const storedState = cookies.get('reddit_state')?.value;
  if (!storedState || storedState !== statePayload.csrf) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=csrf' }
    });
  }

  // Exchange code for access token
  const basicAuth = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
  let tokenData: any;
  try {
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DenverSocialHub/1.0'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDDIT_REDIRECT_URI
      })
    });
    tokenData = await tokenRes.json();
  } catch (err) {
    console.error('Reddit token exchange failed:', err);
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=token_failed' }
    });
  }

  if (!tokenData?.access_token) {
    console.error('No access_token in Reddit response:', tokenData);
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=no_token' }
    });
  }

  // Fetch Reddit user info
  let redditUser: any;
  try {
    const meRes = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'User-Agent': 'DenverSocialHub/1.0'
      }
    });
    redditUser = await meRes.json();
  } catch (err) {
    console.error('Reddit /me failed:', err);
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=fetch_failed' }
    });
  }

  const redditId = redditUser.id;
  const redditUsername = redditUser.name;
  const karma = (redditUser.link_karma || 0) + (redditUser.comment_karma || 0);
  const accountCreated = new Date((redditUser.created_utc || 0) * 1000).toISOString();

  const db = getDB();
  if (!db) {
    return new Response(null, {
      status: 302,
      headers: { 'Location': '/login?error=db' }
    });
  }

  const isConnect = !!(statePayload as any).connect;

  // ── Connect flow: caller is already signed in and is linking Reddit
  // to their existing member row, NOT signing in. Refuse if the Reddit
  // identity is already tied to a different member.
  if (isConnect) {
    const userCookie = cookies.get('dsn_user')?.value;
    let currentUser: any = null;
    try { if (userCookie) currentUser = JSON.parse(userCookie); } catch {}
    if (!currentUser?.email) {
      return new Response(null, { status: 302, headers: { 'Location': '/login?error=not_signed_in' } });
    }
    const owner: any = await db.prepare("SELECT * FROM members WHERE reddit_id = ?").bind(redditId).first();
    if (owner && owner.email !== currentUser.email) {
      return new Response(null, { status: 302, headers: { 'Location': '/profile?connect=reddit_taken' } });
    }
    await db.prepare(
      "UPDATE members SET reddit_id = ?, reddit_username = ?, karma = ?, reddit_account_created = ? WHERE LOWER(email) = LOWER(?)"
    ).bind(redditId, redditUsername, karma, accountCreated, currentUser.email).run();
    // Refresh session cookie with the new reddit_username + karma
    const updated: any = await db.prepare("SELECT id, email, name, role, reddit_username FROM members WHERE LOWER(email) = LOWER(?)").bind(currentUser.email).first();
    const cookieVal = encodeURIComponent(JSON.stringify({
      id: updated?.id ?? currentUser.id,
      email: updated?.email ?? currentUser.email,
      name: updated?.name ?? currentUser.name,
      role: updated?.role ?? currentUser.role ?? 'member',
      reddit_username: redditUsername,
      karma: karma,
    }));
    const headers = new Headers();
    headers.append('Location', '/profile?connect=reddit_ok');
    headers.append('Set-Cookie', `dsn_user=${cookieVal}; Path=/; Max-Age=604800; SameSite=Lax`);
    headers.append('Set-Cookie', 'reddit_state=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly');
    return new Response(null, { status: 302, headers });
  }

  // Check if member exists by reddit_id
  let member: any = await db.prepare(
    "SELECT * FROM members WHERE reddit_id = ?"
  ).bind(redditId).first();

  if (!member) {
    // New user — create account
    await db.prepare(
      `INSERT INTO members (email, name, reddit_id, reddit_username, karma, reddit_account_created, role, approved, onboarding_done)
       VALUES (?, ?, ?, ?, ?, ?, 'member', 1, 0)`
    ).bind(
      `${redditUsername}@reddit.local`,
      redditUsername,
      redditId,
      redditUsername,
      karma,
      accountCreated
    ).run();

    member = await db.prepare("SELECT * FROM members WHERE reddit_id = ?").bind(redditId).first();
  } else {
    // Existing user — update karma and username
    await db.prepare(
      "UPDATE members SET reddit_username = ?, karma = ?, reddit_account_created = ? WHERE reddit_id = ?"
    ).bind(redditUsername, karma, accountCreated, redditId).run();
  }

  // Set session cookie
  const cookieVal = encodeURIComponent(JSON.stringify({
    id: member.id,
    email: member.email,
    name: member.reddit_username || member.name,
    role: member.role || 'member',
    reddit_username: member.reddit_username,
    karma: karma
  }));

  const nextUrl = statePayload.next || '/events';
  const isNewUser = !member.onboarding_done;

  // Clear the state cookie, set session cookie
  const headers = new Headers();
  headers.append('Location', isNewUser ? '/onboarding/1' : nextUrl);
  headers.append('Set-Cookie', `dsn_user=${cookieVal}; Path=/; Max-Age=604800; SameSite=Lax`);
  headers.append('Set-Cookie', 'reddit_state=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly');

  return new Response(null, { status: 302, headers });
};
