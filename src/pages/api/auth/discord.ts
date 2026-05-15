// Discord OAuth — Step 1: redirect to Discord authorize page
import { env } from "cloudflare:workers";

async function getDiscordClientId(): Promise<string | null> {
  const fromEnv = (env as any).DISCORD_CLIENT_ID;
  if (fromEnv) return fromEnv;
  // Fall back to the value saved via /admin/settings (config table)
  const db = (env as any).DB as D1Database | undefined;
  if (!db) return null;
  try {
    const row: any = await db.prepare("SELECT value FROM config WHERE key='discord_client_id'").first();
    return row?.value || null;
  } catch { return null; }
}

export const GET = async ({ request }: { request: Request }) => {
  const DISCORD_CLIENT_ID = await getDiscordClientId();
  if (!DISCORD_CLIENT_ID) {
    return new Response('Discord OAuth not configured. Set it in /admin/settings or via `wrangler secret put DISCORD_CLIENT_ID`.', { status: 500 });
  }

  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/events';
  const connect = url.searchParams.get('connect') === '1';
  // Default redirect URI is computed from the request host so previews
  // and production both work without an env var.
  const redirectUri = (env as any).DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const csrf = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const statePayload = btoa(JSON.stringify({ csrf, next, connect }));

  const authUrl = new URL('https://discord.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', DISCORD_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'identify email');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', statePayload);
  authUrl.searchParams.set('prompt', 'none');

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl.toString(),
      'Set-Cookie': `discord_state=${csrf}; Path=/; Max-Age=600; SameSite=Lax; HttpOnly`,
    },
  });
};
