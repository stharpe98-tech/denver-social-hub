import type { APIContext } from 'astro';
import { getDB } from '../../../lib/db';

export const prerender = false;

function isAdmin(req: Request) {
  const cookie = req.headers.get('cookie') || '';
  const m = cookie.match(/dsn_user=([^;]+)/);
  if (!m) return false;
  try { return JSON.parse(decodeURIComponent(m[1])).email === 'stharpe98@gmail.com'; } catch { return false; }
}

export async function POST({ request }: APIContext) {
  if (!isAdmin(request)) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });
  try {
    const body = await request.json() as any;
    const { action } = body;
    if (action === 'create') {
      await db.prepare(`INSERT INTO events (title,event_type,location,zone,event_month,event_day,spots,price_cap,description,featured) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(body.title,body.event_type||'social',body.location||'',body.zone||'',body.event_month||'',body.event_day||'',parseInt(body.spots)||10,body.price_cap||'',body.description||'',body.featured?1:0).run();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (action === 'update') {
      await db.prepare(`UPDATE events SET title=?,event_type=?,location=?,zone=?,event_month=?,event_day=?,spots=?,price_cap=?,description=?,featured=? WHERE id=?`)
        .bind(body.title,body.event_type||'social',body.location||'',body.zone||'',body.event_month||'',body.event_day||'',parseInt(body.spots)||10,body.price_cap||'',body.description||'',body.featured?1:0,body.id).run();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (action === 'delete') {
      await db.prepare(`DELETE FROM events WHERE id=?`).bind(body.id).run();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (action === 'feature') {
      await db.prepare(`UPDATE events SET featured=? WHERE id=?`).bind(body.featured?1:0,body.id).run();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  } catch(e:any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
