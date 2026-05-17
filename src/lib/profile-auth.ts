// Per-profile editor auth — mirrors the dsn_admin pattern but is
// scoped to a single slug. Cookie name: dsn_profile_<slug>.
// Token format: <slug>.<expires_at_ms>.<hmac_hex>
import type { AstroGlobal, APIContext, AstroCookies } from 'astro';
import { env } from 'cloudflare:workers';

type CookieCtx = Pick<AstroGlobal, 'cookies'> | Pick<APIContext, 'cookies'>;

const FALLBACK_SECRET = 'dsn-profile-v1';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  return ((env as any)?.ADMIN_SECRET as string | undefined) || FALLBACK_SECRET;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function profileCookieName(slug: string): string {
  return `dsn_profile_${slug}`;
}

export async function signProfileToken(slug: string, expiresAtMs: number): Promise<string> {
  const sig = await hmacHex(getSecret(), `${slug}.${expiresAtMs}`);
  return `${slug}.${expiresAtMs}.${sig}`;
}

export async function setProfileCookie(ctx: CookieCtx, slug: string): Promise<void> {
  const expires = Date.now() + COOKIE_MAX_AGE * 1000;
  const token = await signProfileToken(slug, expires);
  ctx.cookies.set(profileCookieName(slug), token, {
    path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: true, secure: true,
  });
}

export function clearProfileCookie(ctx: CookieCtx, slug: string): void {
  ctx.cookies.delete(profileCookieName(slug), { path: '/' });
}

export async function canEditProfile(cookies: CookieCtx['cookies'], slug: string): Promise<boolean> {
  const raw = cookies.get(profileCookieName(slug))?.value;
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length < 3) return false;
  const sig = parts.pop()!;
  const expStr = parts.pop()!;
  const tokSlug = parts.join('.');
  if (tokSlug !== slug) return false;
  const expires = parseInt(expStr, 10);
  if (!Number.isFinite(expires)) return false;
  if (Date.now() > expires) return false;
  const expected = await hmacHex(getSecret(), `${tokSlug}.${expires}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

async function verifyProfileTokenForSlug(raw: string, slug: string): Promise<boolean> {
  const parts = raw.split('.');
  if (parts.length < 3) return false;
  const sig = parts.pop()!;
  const expStr = parts.pop()!;
  const tokSlug = parts.join('.');
  if (tokSlug !== slug) return false;
  const expires = parseInt(expStr, 10);
  if (!Number.isFinite(expires)) return false;
  if (Date.now() > expires) return false;
  const expected = await hmacHex(getSecret(), `${tokSlug}.${expires}`);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

function parseCookieHeader(header: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const piece of header.split(/;\s*/)) {
    const eq = piece.indexOf('=');
    if (eq <= 0) continue;
    const k = piece.slice(0, eq).trim();
    const v = piece.slice(eq + 1).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

/**
 * Resolve the visitor's "current profile" — the first valid, non-expired
 * `dsn_profile_<slug>` cookie that matches a live profile row. Returns
 * null if no valid profile session exists.
 *
 * Note: AstroCookies has no public iteration API for incoming cookies,
 * so we parse the raw Cookie header from the request.
 */
export async function getCurrentProfile(
  cookies: CookieCtx['cookies'],
  db: D1Database,
  request?: Request,
): Promise<{ slug: string; email: string; display_name: string; tier: 'regular' | 'organizer' } | null> {
  if (!db) return null;
  // Build a map of cookie name -> value.
  let jar: Record<string, string> = {};
  if (request) {
    jar = parseCookieHeader(request.headers.get('cookie'));
  }
  // Also let cookies.get() override (covers cookies set earlier in the same request).
  const profileNames = new Set<string>();
  for (const name of Object.keys(jar)) {
    if (name.startsWith('dsn_profile_')) profileNames.add(name);
  }
  for (const name of profileNames) {
    const slug = name.slice('dsn_profile_'.length);
    if (!slug) continue;
    // Prefer value from cookies API (catches mid-request mutations); fall back to header.
    const raw = cookies.get(name)?.value || jar[name];
    if (!raw) continue;
    if (!(await verifyProfileTokenForSlug(raw, slug))) continue;
    const row = await db.prepare(
      `SELECT slug, email, display_name, tier FROM profiles WHERE slug = ? AND status = 'live' LIMIT 1`
    ).bind(slug).first() as any;
    if (!row) continue;
    const tier = (row.tier === 'organizer' ? 'organizer' : 'regular') as 'regular' | 'organizer';
    return {
      slug: row.slug as string,
      email: ((row.email as string) || '').toLowerCase(),
      display_name: (row.display_name as string) || row.slug,
      tier,
    };
  }
  return null;
}

/** Generate a random invisible slug for a regular profile.
 *  Format: `r-<8 base36 chars>`. The `r-` prefix is reserved so it never
 *  collides with the organizer namespace.
 */
export function generateRegularSlug(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += (b % 36).toString(36);
  return `r-${s}${Date.now().toString(36).slice(-2)}`.toLowerCase();
}

const RESERVED_SLUGS = new Set(['new', 'admin', 'api', 'edit', 'login']);
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export function validateSlug(s: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = (s || '').toString().trim().toLowerCase();
  if (!slug) return { ok: false, error: 'Pick a URL.' };
  if (slug.length < 3 || slug.length > 30) return { ok: false, error: 'URL must be 3-30 characters.' };
  if (!SLUG_RE.test(slug)) return { ok: false, error: 'Use lowercase letters, numbers, and hyphens.' };
  if (RESERVED_SLUGS.has(slug)) return { ok: false, error: 'That URL is reserved.' };
  if (slug.startsWith('r-')) return { ok: false, error: 'That URL prefix is reserved.' };
  return { ok: true, slug };
}
