// Coming-soon gate.
//
// While the site is in pre-launch mode, every visitor sees /coming-soon
// EXCEPT:
//   - logged-in organizers (dsn_org cookie present + parses)
//   - logged-in members with role=admin (dsn_user cookie present)
//   - requests for the login pages, APIs, and static assets (so admins
//     can actually sign in to bypass the gate)
//   - requests with ?preview=<key> matching config.preview_key (lets
//     you share a private preview link with a few people)
//
// To turn the gate off, set config.coming_soon_mode='off' from the
// admin dashboard. While 'on' (default), the rewrite is active.
import { defineMiddleware } from 'astro:middleware';

const ALWAYS_ALLOWED = [
  '/coming-soon',
  '/admin',
  '/api/',
  '/_astro/',
  '/_image',
  '/favicon',
  '/logo',
  '/robots.txt',
  '/sitemap.xml',
  '/.well-known/',
];

function pathAlwaysAllowed(p: string): boolean {
  if (p === '/login') return true; // member login form
  for (const prefix of ALWAYS_ALLOWED) {
    if (p === prefix || p.startsWith(prefix)) return true;
  }
  return false;
}

function looksLikeOrg(cookieVal: string | undefined): boolean {
  if (!cookieVal) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieVal));
    return typeof parsed?.id === 'number' || typeof parsed?.id === 'string';
  } catch { return false; }
}

function looksLikeMember(cookieVal: string | undefined): boolean {
  if (!cookieVal) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieVal));
    return typeof parsed?.id !== 'undefined' || typeof parsed?.email === 'string';
  } catch { return false; }
}

function looksLikeAdminMember(cookieVal: string | undefined): boolean {
  if (!cookieVal) return false;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieVal));
    return parsed?.role === 'admin' || parsed?.email === 'stharpe98@gmail.com';
  } catch { return false; }
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  if (pathAlwaysAllowed(path)) return next();

  // Any signed-in user (organizer or member) skips the gate. The point
  // of the coming-soon splash is to gate the *public*, not the people
  // who already have accounts.
  const orgCookie = ctx.cookies.get('dsn_org')?.value;
  if (looksLikeOrg(orgCookie)) return next();
  const userCookie = ctx.cookies.get('dsn_user')?.value;
  if (looksLikeMember(userCookie)) return next();

  // Check the config flag. If unreachable or 'off', let the request through.
  const db = (ctx.locals as any)?.runtime?.env?.DB as D1Database | undefined;
  if (!db) return next();
  try {
    const row = await db.prepare("SELECT value FROM config WHERE key = 'coming_soon_mode'").first() as any;
    const mode = (row?.value ?? 'on').toString().toLowerCase();
    if (mode === 'off') return next();

    // Preview-key bypass: ?preview=<key> sets a 30-day cookie so subsequent
    // visits without the query param still bypass the gate.
    const previewParam = url.searchParams.get('preview');
    const previewCookie = ctx.cookies.get('dsn_preview')?.value;
    if (previewParam || previewCookie) {
      const keyRow = await db.prepare("SELECT value FROM config WHERE key = 'preview_key'").first() as any;
      const keyVal = keyRow?.value;
      if (keyVal && (previewParam === keyVal || previewCookie === keyVal)) {
        if (previewParam) {
          ctx.cookies.set('dsn_preview', keyVal, { path: '/', maxAge: 60*60*24*30, sameSite: 'lax', httpOnly: true });
        }
        return next();
      }
    }
  } catch { return next(); }

  return ctx.rewrite('/coming-soon');
});
