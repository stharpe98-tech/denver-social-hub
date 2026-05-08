import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async () => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const { results } = await db.prepare(`SELECT * FROM event_templates ORDER BY created_at DESC`).all();
  return new Response(JSON.stringify(results ?? []), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    if (b.action === 'save') {
      const res = await db.prepare(`INSERT INTO event_templates (organizer_id, name, title, description, time_label, location, location_detail, template, slots_json) VALUES (?,?,?,?,?,?,?,?,?)`)
        .bind(b.organizer_id??0, b.name??'My Template', b.title??'', b.description??'', b.time_label??'', b.location??'', b.location_detail??'', b.template??'warm', b.slots_json??'[]').run();
      return new Response(JSON.stringify({ ok: true, id: res.meta.last_row_id }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (b.action === 'delete') {
      await db.prepare(`DELETE FROM event_templates WHERE id=?`).bind(b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
