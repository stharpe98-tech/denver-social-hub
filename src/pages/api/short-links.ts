import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async () => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const { results } = await db.prepare(`SELECT * FROM short_links ORDER BY created_at DESC`).all();
  return new Response(JSON.stringify(results ?? []), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    if (b.action === 'create') {
      const slug = b.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      await db.prepare(`INSERT INTO short_links (slug, url, label) VALUES (?,?,?)`).bind(slug, b.url, b.label ?? '').run();
      return new Response(JSON.stringify({ ok: true, slug }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (b.action === 'delete') {
      await db.prepare(`DELETE FROM short_links WHERE id=?`).bind(b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (b.action === 'update') {
      await db.prepare(`UPDATE short_links SET url=?, label=? WHERE id=?`).bind(b.url, b.label, b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
