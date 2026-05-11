// Discord OAuth — Step 1: redirect to Discord authorize page
import { env } from "cloudflare:workers";

export const GET = async ({ request }: { request: Request }) => {
  const DISCORD_CLIENT_ID = (env as any).DISCORD_CLIENT_ID;
  if (!DISCORD_CLIENT_ID) {
    return new Response('Discord OAuth not configured. Set DISCORD_CLIENT_ID via `wrangler secret put`.', { status: 500 });
  }

  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/events';
  // Default redirect URI is computed from the request host so previews
  // and production both work without an env var.
  const redirectUri = (env as any).DISCORD_REDIRECT_URI || `${url.origin}/api/auth/discord/callback`;

  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const csrf = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  const statePayload = btoa(JSON.stringify({ csrf, next }));

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
