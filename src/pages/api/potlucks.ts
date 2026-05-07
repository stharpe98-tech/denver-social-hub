import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async () => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const { results } = await db.prepare(\`
    SELECT p.*, 
      COUNT(DISTINCT CASE WHEN r.rsvp='yes' THEN r.id END) as attendee_count,
      COUNT(DISTINCT CASE WHEN r.rsvp='yes' AND r.dish != '' THEN LOWER(r.dish) END) as dish_count
    FROM potlucks p
    LEFT JOIN potluck_rsvp r ON r.potluck_id = p.id
    GROUP BY p.id
    ORDER BY p.id DESC
  \`).all();
  return new Response(JSON.stringify(results ?? []), { headers: { 'Content-Type': 'application/json' } });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    const action = b.action;
    if (action === 'create') {
      const result = await db.prepare(\`
        INSERT INTO potlucks (title, description, date_label, time_label, location, location_detail, status)
        VALUES (?,?,?,?,?,?,?)
      \`).bind(b.title??'New Potluck', b.description??'', b.date_label??'', b.time_label??'', b.location??'', b.location_detail??'', b.status??'upcoming').run();
      return new Response(JSON.stringify({ ok: true, id: result.meta.last_row_id }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'update') {
      await db.prepare(\`UPDATE potlucks SET title=?,description=?,date_label=?,time_label=?,location=?,location_detail=?,status=? WHERE id=?\`)
        .bind(b.title, b.description, b.date_label, b.time_label, b.location, b.location_detail, b.status, b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    if (action === 'delete_rsvp') {
      await db.prepare(\`DELETE FROM potluck_rsvp WHERE id=?\`).bind(b.id).run();
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: false, error: 'Unknown action' }), { status: 400 });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
