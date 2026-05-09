import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensurePasskeySchema } from '../../../lib/passkey-schema';
import { requireApprovedOrg } from '../../../lib/admin-auth';

export const prerender = false;

export const GET: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  const org = gate;

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensurePasskeySchema(db);

  const rows = await db.prepare(
    "SELECT id, device_label, transports, created_at FROM passkeys WHERE organizer_id = ? ORDER BY created_at DESC"
  ).bind(org.id).all();

  return new Response(JSON.stringify({ passkeys: rows.results ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  const org = gate;

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensurePasskeySchema(db);

  const body = await ctx.request.json() as { action: string; id?: number };
  if (body.action === 'delete' && body.id) {
    await db.prepare("DELETE FROM passkeys WHERE id = ? AND organizer_id = ?")
      .bind(body.id, org.id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400 });
};
