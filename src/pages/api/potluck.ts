import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async () => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const { results } = await db.prepare(`
    SELECT LOWER(dish) as dish, COUNT(*) as count
    FROM potluck_rsvp
    WHERE dish IS NOT NULL AND dish != '' AND rsvp = 'yes'
    GROUP BY LOWER(dish)
  `).all();
  return new Response(JSON.stringify(results ?? []), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    await db.prepare(`
      INSERT INTO potluck_rsvp (name,handle,platforms,rsvp,guest_count,dish,dish_category,dietary,utensils,early_arrive,seating)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      b.name??'', b.handle??'', b.platforms??'', b.rsvp??'',
      parseInt(b.guestCount??'1'), b.dish??'', b.dishCategory??'',
      b.dietary??'', b.utensils?1:0, b.earlyArrive?1:0, b.seating?1:0
    ).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
