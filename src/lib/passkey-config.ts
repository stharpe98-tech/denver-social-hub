// Derives WebAuthn config from the incoming request so the same code
// works on the workers.dev preview, the workers.dev production URL, and
// (when DNS is pointed) denversocialhub.com without redeploys.
//
// rpID must equal the eTLD+1 the user can register; for *.workers.dev
// that's the full subdomain (workers.dev is on the Public Suffix List).
export function getRpConfig(request: Request): { rpID: string; origin: string; rpName: string } {
  const url = new URL(request.url);
  return {
    rpID: url.hostname,
    origin: `${url.protocol}//${url.host}`,
    rpName: 'Denver Social Admin',
  };
}

// Cookie name for round-tripping the WebAuthn challenge between the
// "options" and "verify" endpoints. We prefer a short-lived cookie over
// a DB row because it sidesteps any cross-region D1 latency.
export const CHALLENGE_COOKIE = 'dsn_wa_chal';
export const CHALLENGE_TTL_SECONDS = 300;
