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
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400 });
  try {
    const member = await db.prepare(`SELECT * FROM members WHERE id=?`).bind(parseInt(id)).first();
    if (!member) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    return new Response(JSON.stringify(member));
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}

export async function POST({ request }: APIContext) {
  if (!isAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    const body = await request.json() as any;
    const { action, id } = body;

    if (action === 'delete') {
      await db.prepare(`DELETE FROM members WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'clear_pending') {
      await db.prepare(`DELETE FROM members WHERE onboarding_done=0 OR onboarding_done IS NULL`).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'approve') {
      await db.prepare(`UPDATE members SET approved=1, approved_at=datetime('now'), approved_by='admin' WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'suspend') {
      await db.prepare(`UPDATE members SET suspended=1, suspended_reason=? WHERE id=?`).bind(body.reason || 'Admin action', id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'unsuspend') {
      await db.prepare(`UPDATE members SET suspended=0, suspended_reason='', no_show_count=0 WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'update_role') {
      await db.prepare(`UPDATE members SET role=? WHERE id=?`).bind(body.role || 'member', id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'update') {
      await db.prepare(`UPDATE members SET name=?, bio=?, neighborhood=?, role=? WHERE id=?`)
        .bind(body.name || '', body.bio || '', body.neighborhood || '', body.role || 'member', id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    if (action === 'reset_noshows') {
      await db.prepare(`UPDATE members SET no_show_count=0 WHERE id=?`).bind(id).run();
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  } catch (e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
