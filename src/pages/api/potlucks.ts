import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePotluckSchema } from '../../lib/potluck-schema';
import { potluckSlug } from '../../lib/slug';

// Pick an unused slug, suffixing -2, -3, … if the base is taken.
async function assignSlug(db: D1Database, eventDate: string | null, id: number): Promise<string> {
  const base = potluckSlug(eventDate, id);
  let candidate = base;
  for (let n = 2; n <= 6; n++) {
    const row = await db.prepare('SELECT 1 FROM potlucks WHERE slug=? AND id<>?').bind(candidate, id).first();
    if (!row) return candidate;
    candidate = `${base}-${n}`;
  }
  return `potluck-${id}`;
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
      const ins = await db.prepare(`INSERT INTO potlucks (title,description,date_label,time_label,location,location_detail,status,event_date) VALUES (?,?,?,?,?,?,?,?)`)
        .bind(b.title??'New Potluck',b.description??'',b.date_label??'',b.time_label??'',b.location??'',b.location_detail??'','pending',b.event_date??null).run();
      const newId = Number((ins as any).meta?.last_row_id) || 0;
      if (newId) {
        const slug = await assignSlug(db, b.event_date ?? null, newId);
        await db.prepare('UPDATE potlucks SET slug=? WHERE id=?').bind(slug, newId).run();
      }
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
      const newId = Number((result as any).meta?.last_row_id) || 0;
      if (newId) {
        const slug = await assignSlug(db, b.event_date ?? null, newId);
        await db.prepare('UPDATE potlucks SET slug=? WHERE id=?').bind(slug, newId).run();
      }
      return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'update') {
      await db.prepare(`UPDATE potlucks SET title=?,description=?,date_label=?,time_label=?,location=?,location_detail=?,status=?,template=?,locked=?,organizer_email=?,event_date=?,cover_photo=? WHERE id=?`)
        .bind(b.title,b.description,b.date_label,b.time_label,b.location,b.location_detail,b.status,b.template??'warm',b.locked?1:0,b.organizer_email??'',b.event_date??null,b.cover_photo??null,b.id).run();
      // Backfill slug if missing or if event_date changed
      const cur: any = await db.prepare('SELECT slug, event_date FROM potlucks WHERE id=?').bind(b.id).first();
      if (cur && (!cur.slug || (b.event_date && b.event_date !== cur.event_date))) {
        const slug = await assignSlug(db, b.event_date ?? cur.event_date ?? null, parseInt(b.id));
        await db.prepare('UPDATE potlucks SET slug=? WHERE id=?').bind(slug, b.id).run();
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'duplicate') {
      const sourceId = parseInt(b.id);
      if (!sourceId) return new Response(JSON.stringify({ ok: false, error: 'missing_id' }), { status: 400 });
      const src: any = await db.prepare(`SELECT * FROM potlucks WHERE id=?`).bind(sourceId).first();
      if (!src) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
      const ins = await db.prepare(`
        INSERT INTO potlucks (title,description,date_label,time_label,location,location_detail,status,template,locked,organizer_email,event_date,cover_photo)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        (b.new_title ?? src.title ?? '') + (b.new_title ? '' : ' (Copy)'),
        src.description ?? '',
        '', '', // intentionally clear date/time labels — duplicates need fresh dates
        src.location ?? '',
        src.location_detail ?? '',
        'upcoming',
        src.template ?? 'warm',
        0, // unlock the copy even if source is locked
        src.organizer_email ?? '',
        null, // clear event_date so reminders don't fire on the old date
        src.cover_photo ?? null,
      ).run();
      const newId = ins.meta.last_row_id;
      // Copy slots (no claims, no reminder state)
      await db.prepare(`
        INSERT INTO potluck_slots (potluck_id, category, suggestion, max_claims, sort_order, slot_time)
        SELECT ?, category, suggestion, max_claims, sort_order, slot_time
        FROM potluck_slots WHERE potluck_id = ?
      `).bind(newId, sourceId).run();
      return new Response(JSON.stringify({ ok: true, id: newId }), { headers: { 'Content-Type': 'application/json' } });
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
