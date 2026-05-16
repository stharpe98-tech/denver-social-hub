import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePotluckSchema } from '../../lib/potluck-schema';
import { potluckSlug } from '../../lib/slug';

async function assignSlug(db: any, id: number, eventDate: string | null) {
  const base = potluckSlug(eventDate, id);
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    try {
      const existing = await db.prepare(`SELECT id FROM potlucks WHERE slug = ? AND id != ?`).bind(candidate, id).first();
      if (!existing) {
        await db.prepare(`UPDATE potlucks SET slug = ? WHERE id = ?`).bind(candidate, id).run();
        return candidate;
      }
    } catch {}
  }
  const fallback = `potluck-${id}`;
  await db.prepare(`UPDATE potlucks SET slug = ? WHERE id = ?`).bind(fallback, id).run();
  return fallback;
}

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const type = url.searchParams.get('type');
  if (type === 'config') {
    const { results } = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg: Record<string,string> = {};
    (results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
    return new Response(JSON.stringify(cfg), { headers: { 'Content-Type': 'application/json' } });
  }
  const { results } = await db.prepare(`
    SELECT p.*,
      COUNT(DISTINCT CASE WHEN r.rsvp='yes' THEN r.id END) as attendee_count,
      COUNT(DISTINCT CASE WHEN r.rsvp='yes' AND r.dish!='' THEN LOWER(r.dish) END) as dish_count
    FROM potlucks p LEFT JOIN potluck_rsvp r ON r.potluck_id=p.id
    GROUP BY p.id ORDER BY p.id DESC
  `).all();
  return new Response(JSON.stringify(results ?? []), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    const action = b.action;
    await ensurePotluckSchema(db);
    if (action === 'suggest') {
      const r = await db.prepare(`INSERT INTO potlucks (title,description,date_label,time_label,location,location_detail,status,event_date) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(b.title??'New Potluck',b.description??'',b.date_label??'',b.time_label??'',b.location??'',b.location_detail??'','pending',b.event_date??null).run();
      await assignSlug(db, Number(r.meta.last_row_id), b.event_date ?? null);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'approve') {
      await db.prepare(`UPDATE potlucks SET status='upcoming' WHERE id=?`).bind(b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'reject') {
      await db.prepare(`DELETE FROM potlucks WHERE id=? AND status='pending'`).bind(b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'create') {
      const result = await db.prepare(`INSERT INTO potlucks (title,description,date_label,time_label,location,location_detail,status,event_date,cover_photo) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(b.title??'',b.description??'',b.date_label??'',b.time_label??'',b.location??'',b.location_detail??'',b.status??'upcoming',b.event_date??null,b.cover_photo??null).run();
      const newId = Number(result.meta.last_row_id);
      const slug = await assignSlug(db, newId, b.event_date ?? null);
      return new Response(JSON.stringify({ ok: true, id: newId, slug }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'update') {
      await db.prepare(`UPDATE potlucks SET title=?,description=?,date_label=?,time_label=?,location=?,location_detail=?,status=?,template=?,locked=?,organizer_email=?,event_date=?,cover_photo=? WHERE id=?`)
        .bind(b.title,b.description,b.date_label,b.time_label,b.location,b.location_detail,b.status,b.template??'warm',b.locked?1:0,b.organizer_email??'',b.event_date??null,b.cover_photo??null,b.id).run();
      const cur = await db.prepare(`SELECT slug FROM potlucks WHERE id=?`).bind(b.id).first();
      if (!cur?.slug) await assignSlug(db, Number(b.id), b.event_date ?? null);
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'delete_rsvp') {
      await db.prepare(`DELETE FROM potluck_rsvp WHERE id=?`).bind(b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'set_config') {
      await db.prepare(`INSERT OR REPLACE INTO config (key,value) VALUES (?,?)`).bind(b.key,b.value).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
