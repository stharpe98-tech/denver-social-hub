import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { requireApprovedOrg } from '../../../lib/admin-auth';
import {
  DEVICE_COOKIE,
  ensureTrustedDeviceSchema, hashDeviceToken,
} from '../../../lib/pin-schema';

export const prerender = false;

// Lists trusted devices for the signed-in organizer. Marks the current
// browser's device with `is_current: true` so the UI can label it.
export const GET: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  const org = gate;

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensureTrustedDeviceSchema(db);

  const rows = await db.prepare(
    "SELECT id, device_token_hash, device_label, created_at, last_used_at FROM trusted_devices WHERE organizer_id = ? ORDER BY created_at DESC"
  ).bind(org.id).all();

  const currentToken = ctx.cookies.get(DEVICE_COOKIE)?.value;
  const currentHash = currentToken ? await hashDeviceToken(currentToken) : null;

  const devices = (rows.results ?? []).map((r: any) => ({
    id: r.id,
    device_label: r.device_label,
    created_at: r.created_at,
    last_used_at: r.last_used_at,
    is_current: !!(currentHash && r.device_token_hash === currentHash),
  }));

  return new Response(JSON.stringify({ devices }), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  const org = gate;

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensureTrustedDeviceSchema(db);

  const body = await ctx.request.json() as { action: string; id?: number };
  if (body.action === 'delete' && body.id) {
    await db.prepare("DELETE FROM trusted_devices WHERE id = ? AND organizer_id = ?")
      .bind(body.id, org.id).run();
    // If they revoked the current device, clear our cookie too
    const currentToken = ctx.cookies.get(DEVICE_COOKIE)?.value;
    if (currentToken) {
      const hash = await hashDeviceToken(currentToken);
      const stillExists = await db.prepare(
        "SELECT id FROM trusted_devices WHERE device_token_hash = ?"
      ).bind(hash).first();
      if (!stillExists) ctx.cookies.delete(DEVICE_COOKIE, { path: '/' });
    }
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (body.action === 'delete_all') {
    await db.prepare("DELETE FROM trusted_devices WHERE organizer_id = ?").bind(org.id).run();
    ctx.cookies.delete(DEVICE_COOKIE, { path: '/' });
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400 });
};
