import type { AstroGlobal, APIContext } from 'astro';
import { getDB } from './db';

type CookieCtx = Pick<AstroGlobal, 'cookies'> | Pick<APIContext, 'cookies'>;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';

export interface OrgSession {
  id: number;
  name: string;
  email: string;
  plan: string;
}

export interface Org extends OrgSession {
  approved_for_potlucks: number;
}

export async function ensureOrgSchema(db: D1Database): Promise<void> {
  const cols = await db.prepare("PRAGMA table_info(organizers)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));
  if (!names.has('approved_for_potlucks')) {
    await db.prepare("ALTER TABLE organizers ADD COLUMN approved_for_potlucks INTEGER DEFAULT 0").run();
  }
  // Auto-approve the super-admin so first deploy works without manual D1 edit.
  await db.prepare("UPDATE organizers SET approved_for_potlucks = 1 WHERE LOWER(email) = ?")
    .bind(SUPER_ADMIN_EMAIL).run();
}

export function getOrgSession(ctx: CookieCtx): OrgSession | null {
  const cookie = ctx.cookies.get('dsn_org')?.value;
  if (!cookie) return null;
  try { return JSON.parse(cookie) as OrgSession; } catch { return null; }
}

// For pages: returns the full Org row (including approval flag) or a Response
// that the caller should `return` to redirect/deny. Sample usage:
//   const gate = await requireApprovedOrg(Astro);
//   if (gate instanceof Response) return gate;
//   const org = gate;
export async function requireApprovedOrg(Astro: AstroGlobal): Promise<Org | Response> {
  const session = getOrgSession(Astro);
  if (!session) return Astro.redirect('/admin/login');
  const db = getDB();
  if (!db) return new Response('DB unavailable', { status: 500 });
  await ensureOrgSchema(db);
  const row = await db.prepare(
    "SELECT id, name, email, plan, approved_for_potlucks FROM organizers WHERE id = ?"
  ).bind(session.id).first() as Org | null;
  if (!row) return Astro.redirect('/admin/login');
  if (!row.approved_for_potlucks) return Astro.redirect('/admin/pending');
  return row;
}

export function isSuperAdmin(org: { email: string }): boolean {
  return org.email.toLowerCase() === SUPER_ADMIN_EMAIL;
}
