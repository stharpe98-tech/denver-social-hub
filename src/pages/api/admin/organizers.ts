import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureOrgSchema, getOrgSession, isSuperAdmin } from '../../../lib/admin-auth';

// Only the super-admin can change approval state. Approved-but-non-super
// organizers can manage potlucks but not gate other organizers in/out.
export const POST: APIRoute = async (ctx) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  const session = getOrgSession(ctx);
  if (!session) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 401 });
  if (!isSuperAdmin(session)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), { status: 403 });
  }
  await ensureOrgSchema(db);

  try {
    const b = await ctx.request.json() as Record<string, any>;
    const id = parseInt(b.id);
    if (!id) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });

    if (b.action === 'approve') {
      await db.prepare("UPDATE organizers SET approved_for_potlucks = 1 WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (b.action === 'revoke') {
      // Don't let the super-admin revoke their own access by accident.
      const row = await db.prepare("SELECT email FROM organizers WHERE id = ?").bind(id).first() as any;
      if (row && isSuperAdmin(row)) {
        return new Response(JSON.stringify({ ok: false, error: 'cannot_revoke_super' }), { status: 400 });
      }
      await db.prepare("UPDATE organizers SET approved_for_potlucks = 0 WHERE id = ?").bind(id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, error: 'unknown_action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
