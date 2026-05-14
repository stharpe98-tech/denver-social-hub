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
  let session = getOrgSession(Astro);
  const db = getDB();
  if (!db) return new Response('DB unavailable', { status: 500 });
  await ensureOrgSchema(db);

  // Bridge: if the visitor has no organizer session but their member
  // (dsn_user) cookie is the super-admin or role=admin, auto-issue an
  // organizer session from the matching organizers row so admins don't
  // have to log in twice to reach /admin/*.
  if (!session) {
    const userCookie = Astro.cookies.get('dsn_user')?.value;
    if (userCookie) {
      try {
        const u = JSON.parse(userCookie);
        const email = (u?.email || '').toLowerCase();
        const isAdmin = email === SUPER_ADMIN_EMAIL || u?.role === 'admin';
        if (isAdmin && email) {
          let orgRow = await db.prepare(
            "SELECT id, name, email, plan FROM organizers WHERE LOWER(email) = ?"
          ).bind(email).first() as OrgSession | null;
          if (!orgRow && email === SUPER_ADMIN_EMAIL) {
            await db.prepare(
              "INSERT INTO organizers (name, email, plan, approved_for_potlucks) VALUES (?, ?, 'free', 1)"
            ).bind(u?.name || 'Admin', email).run();
            orgRow = await db.prepare(
              "SELECT id, name, email, plan FROM organizers WHERE LOWER(email) = ?"
            ).bind(email).first() as OrgSession | null;
          }
          if (orgRow) {
            session = orgRow;
            Astro.cookies.set('dsn_org', JSON.stringify(orgRow), {
              path: '/', maxAge: 60 * 60 * 24 * 30, sameSite: 'lax', httpOnly: true,
            });
          }
        }
      } catch {}
    }
  }

  if (!session) return Astro.redirect('/admin/login');
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
