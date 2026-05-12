// Reddit OAuth — Step 1: redirect user to Reddit authorization
import { env } from "cloudflare:workers";

export const GET = async ({ request }: { request: Request }) => {
  const REDDIT_CLIENT_ID = (env as any).REDDIT_CLIENT_ID;
  const REDDIT_REDIRECT_URI = (env as any).REDDIT_REDIRECT_URI || 'https://denversocialhub.com/api/auth/reddit/callback';

  if (!REDDIT_CLIENT_ID) {
    return new Response(JSON.stringify({ error: 'Reddit OAuth not configured' }), { status: 500 });
  }

  // Generate random state for CSRF protection
  const stateBytes = new Uint8Array(16);
  crypto.getRandomValues(stateBytes);
  const state = Array.from(stateBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const url = new URL(request.url);
  const next = url.searchParams.get('next') || '/events';
  const connect = url.searchParams.get('connect') === '1';

  // Encode next URL + connect flag into state so the callback knows
  // whether to merge identities into the existing session or sign in.
  const statePayload = btoa(JSON.stringify({ csrf: state, next, connect }));

  const authUrl = new URL('https://www.reddit.com/api/v1/authorize');
  authUrl.searchParams.set('client_id', REDDIT_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('state', statePayload);
  authUrl.searchParams.set('redirect_uri', REDDIT_REDIRECT_URI);
  authUrl.searchParams.set('duration', 'temporary');
  authUrl.searchParams.set('scope', 'identity');

  return new Response(null, {
    status: 302,
    headers: {
      'Location': authUrl.toString(),
      'Set-Cookie': `reddit_state=${state}; Path=/; Max-Age=600; SameSite=Lax; HttpOnly`
    }
  });
};
