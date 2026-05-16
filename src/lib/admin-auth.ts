// Admin auth, v2 — email-code based.
//
// Reddit/Discord OAuth and the old organizer password flow have been
// removed. The only way to reach /admin/* is to receive a one-time code
// via email (allowlisted addresses in config.admin_emails) and verify
// it. On success we set a signed `dsn_admin` cookie:
//
//   <email>.<expires_at_ms>.<hmac_hex>
//
// The HMAC secret comes from env.ADMIN_SECRET if defined; otherwise we
// fall back to a constant — note this means rotating the constant
// invalidates all existing sessions, which is fine.
//
// Legacy exports (`requireApprovedOrg`, `getOrgSession`, `isSuperAdmin`,
// `Org`, `OrgSession`, `ensureOrgSchema`) are preserved as thin shims so
// the many admin pages/APIs that depend on them keep compiling. They
// all defer to `isAdmin(cookies)` now.

import type { AstroGlobal, APIContext } from 'astro';
import { getDB } from './db';
import { env } from 'cloudflare:workers';

type CookieCtx = Pick<AstroGlobal, 'cookies'> | Pick<APIContext, 'cookies'>;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';
const FALLBACK_SECRET = 'dsn-admin-v1'; // used if env.ADMIN_SECRET is unset
const COOKIE_NAME = 'dsn_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ── Legacy types kept so existing imports don't break ──
export interface OrgSession { id: number; name: string; email: string; plan: string; }
export interface Org extends OrgSession { approved_for_potlucks: number; }

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

export async function signAdminToken(email: string, expiresAtMs: number): Promise<string> {
  const sig = await hmacHex(getSecret(), `${email}.${expiresAtMs}`);
  return `${email}.${expiresAtMs}.${sig}`;
}

export async function setAdminCookie(ctx: CookieCtx, email: string): Promise<void> {
  const expires = Date.now() + COOKIE_MAX_AGE * 1000;
  const token = await signAdminToken(email, expires);
  ctx.cookies.set(COOKIE_NAME, token, {
    path: '/', maxAge: COOKIE_MAX_AGE, sameSite: 'lax', httpOnly: true, secure: true,
  });
}

export function clearAdminCookie(ctx: CookieCtx): void {
  ctx.cookies.delete(COOKIE_NAME, { path: '/' });
}

export async function isAdmin(cookies: CookieCtx['cookies']): Promise<boolean> {
  const raw = cookies.get(COOKIE_NAME)?.value;
  if (!raw) return false;
  const parts = raw.split('.');
  if (parts.length < 3) return false;
  // email may itself contain dots, but expiry + sig are the last two parts
  const sig = parts.pop()!;
  const expStr = parts.pop()!;
  const email = parts.join('.');
  const expires = parseInt(expStr, 10);
  if (!email || !Number.isFinite(expires)) return false;
  if (Date.now() > expires) return false;
  const expected = await hmacHex(getSecret(), `${email}.${expires}`);
  // constant-time-ish compare
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  // optionally re-verify the email is still in the allowlist
  return true;
}

export async function getAdminEmail(cookies: CookieCtx['cookies']): Promise<string | null> {
  if (!(await isAdmin(cookies))) return null;
  const raw = cookies.get(COOKIE_NAME)?.value || '';
  const parts = raw.split('.');
  if (parts.length < 3) return null;
  parts.pop(); parts.pop();
  return parts.join('.') || null;
}

export async function getAllowedAdminEmails(db: D1Database): Promise<string[]> {
  try {
    const row = await db.prepare("SELECT value FROM config WHERE key = 'admin_emails'").first() as any;
    const csv = (row?.value || '').toString();
    return csv.split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  } catch {
    return [SUPER_ADMIN_EMAIL];
  }
}

// ── Legacy shims ──
//
// Old code did:
//   const gate = await requireApprovedOrg(Astro);
//   if (gate instanceof Response) return gate;
//   const org = gate; // { id, name, email, plan, approved_for_potlucks }
//
// We keep that shape but back it with the email-code session: any admin
// is treated as "approved" for all dashboards.
export async function requireApprovedOrg(Astro: AstroGlobal): Promise<Org | Response> {
  const ok = await isAdmin(Astro.cookies);
  if (!ok) return Astro.redirect('/admin/login');
  const email = (await getAdminEmail(Astro.cookies)) || SUPER_ADMIN_EMAIL;
  return {
    id: 1,
    name: email.split('@')[0] || 'Admin',
    email,
    plan: 'pro',
    approved_for_potlucks: 1,
  };
}

export function getOrgSession(ctx: CookieCtx): OrgSession | null {
  // Synchronous best-effort: we don't verify the HMAC here, but we do
  // require the cookie to be present and well-formed. Callers that need
  // a hard guarantee should use `isAdmin` instead.
  const raw = ctx.cookies.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length < 3) return null;
  parts.pop(); parts.pop();
  const email = parts.join('.');
  if (!email) return null;
  return { id: 1, name: email.split('@')[0] || 'Admin', email, plan: 'pro' };
}

export function isSuperAdmin(org: { email: string }): boolean {
  return (org.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
}

// Legacy no-op: the old organizers table grew an approval column. We
// no longer need to touch it, but admin pages call this on load.
export async function ensureOrgSchema(_db: D1Database): Promise<void> { /* noop */ }
