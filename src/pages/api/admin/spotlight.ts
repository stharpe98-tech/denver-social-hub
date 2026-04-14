import type { APIContext } from 'astro';
import { getDB } from '../../../lib/db';

export const prerender = false;

function isAdmin(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/dsn_user=([^;]+)/);
  if (!m) return false;
  try { return JSON.parse(decodeURIComponent(m[1])).email === 'stharpe98@gmail.com'; } catch { return false; }
}

export async function GET({ request }: APIContext) {
  if (!isAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    const rows = (await db.prepare(`SELECT * FROM member_spotlights ORDER BY id DESC`).all())?.results || [];
    return new Response(JSON.stringify(rows));
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}

export async function POST({ request }: APIContext) {
  if (!isAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    const { action, id, member_email, blurb, week_of } = await request.json() as any;
    if (action === 'create' && member_email && blurb && week_of) {
      await db.prepare(`INSERT INTO member_spotlights (member_email, blurb, week_of) VALUES (?,?,?)`).bind(member_email, blurb, week_of).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'delete' && id) {
      await db.prepare(`DELETE FROM member_spotlights WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
