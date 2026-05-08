import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const pid = url.searchParams.get('id') || '1';
  const { results } = await db.prepare(
    `SELECT id, name, comment, created_at FROM potluck_comments WHERE potluck_id=? ORDER BY created_at DESC`
  ).bind(pid).all();
  return new Response(JSON.stringify(results ?? []), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    if (!b.name?.trim() || !b.comment?.trim()) return new Response(JSON.stringify({ ok: false }), { status: 400 });
    await db.prepare(`INSERT INTO potluck_comments (potluck_id, name, comment) VALUES (?,?,?)`)
      .bind(parseInt(b.potluckId ?? '1'), b.name.trim(), b.comment.trim()).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
