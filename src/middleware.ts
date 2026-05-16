// Coming-soon gate.
//
// While the site is in pre-launch mode, every visitor sees /coming-soon
// EXCEPT:
//   - logged-in admins (dsn_admin cookie present)
//   - requests for the login pages, APIs, and static assets
//   - requests with ?preview=<key> matching config.preview_key
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
  for (const prefix of ALWAYS_ALLOWED) {
    if (p === prefix || p.startsWith(prefix)) return true;
  }
  return false;
}

function looksLikeAdmin(cookieVal: string | undefined): boolean {
  if (!cookieVal) return false;
  // Three dot-separated parts: email, expires, hmac. Real verification
  // happens server-side in isAdmin(); this is just the gate signal.
  return cookieVal.split('.').length >= 3;
}

export const onRequest = defineMiddleware(async (ctx, next) => {
  const url = new URL(ctx.request.url);
  const path = url.pathname;

  if (pathAlwaysAllowed(path)) return next();

  const adminCookie = ctx.cookies.get('dsn_admin')?.value;
  if (looksLikeAdmin(adminCookie)) return next();

  const db = (ctx.locals as any)?.runtime?.env?.DB as D1Database | undefined;
  if (!db) return next();
  try {
    const row = await db.prepare("SELECT value FROM config WHERE key = 'coming_soon_mode'").first() as any;
    const mode = (row?.value ?? 'on').toString().toLowerCase();
    if (mode === 'off') return next();

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
