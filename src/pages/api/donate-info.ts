import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async () => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const cfg = await db.prepare(`SELECT key, value FROM config WHERE key IN ('venmo_handle','cashapp_handle')`).all();
    const data: Record<string,string> = {};
    (cfg.results ?? []).forEach((r: any) => { data[r.key] = r.value; });
    return new Response(JSON.stringify({
      venmo: data.venmo_handle || null,
      cashapp: data.cashapp_handle || null,
    }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  } catch {
    return new Response(JSON.stringify({ ok: false }), { status: 500 });
  }
};
