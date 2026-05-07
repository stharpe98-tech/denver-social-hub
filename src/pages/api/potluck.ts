import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const pid = url.searchParams.get('id') || '1';
  const { results } = await db.prepare(\`
    SELECT LOWER(dish) as dish, COUNT(*) as count
    FROM potluck_rsvp
    WHERE dish IS NOT NULL AND dish != '' AND rsvp = 'yes' AND potluck_id = ?
    GROUP BY LOWER(dish)
  \`).bind(pid).all();
  return new Response(JSON.stringify(results ?? []), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    await db.prepare(\`
      INSERT INTO potluck_rsvp (potluck_id,name,handle,platforms,rsvp,guest_count,dish,dish_category,dietary,utensils,early_arrive,seating)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    \`).bind(
      parseInt(b.potluckId ?? '1'),
      b.name??'', b.handle??'', b.platforms??'', b.rsvp??'',
      parseInt(b.guestCount??'1'), b.dish??'', b.dishCategory??'',
      b.dietary??'', b.utensils?1:0, b.earlyArrive?1:0, b.seating?1:0
    ).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
