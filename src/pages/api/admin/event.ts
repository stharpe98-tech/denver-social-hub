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
      await db.prepare(`INSERT INTO events (title,event_type,location,zone,event_month,event_day,spots,price_cap,description,featured,plus_one_allowed,difficulty,pet_friendly,cell_service,packing_list,reservation_by,price_per_person,payment_link,min_group_size,deposit_required,deposit_amount,commit_deadline,potluck_categories) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(
          body.title, body.event_type||'social', body.location||'', body.zone||'', body.event_month||'', body.event_day||'',
          parseInt(body.spots)||10, body.price_cap||'', body.description||'', body.featured?1:0,
          body.plus_one_allowed!==undefined?parseInt(body.plus_one_allowed):1,
          body.difficulty||'', body.pet_friendly?1:0, body.cell_service||'', body.packing_list||'',
          body.reservation_by||'', body.price_per_person||'', body.payment_link||'',
          parseInt(body.min_group_size)||0, body.deposit_required?1:0,
          parseFloat(body.deposit_amount)||10, body.commit_deadline||'',
          body.potluck_categories||'Appetizers,Mains,Sides,Desserts,Drinks'
        ).run();
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
    if (action === 'archive_past') {
      await db.prepare(`UPDATE events SET is_past=1 WHERE is_past=0`).run();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400 });
  } catch(e:any) { return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
}
