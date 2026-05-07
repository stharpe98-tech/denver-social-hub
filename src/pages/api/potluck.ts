import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ slots: [], dishes: [] }), { headers: { 'Content-Type': 'application/json' } });
  const pid = url.searchParams.get('id') || '1';

  const slotsRes = await db.prepare(`
    SELECT s.id, s.category, s.suggestion, s.max_claims, s.sort_order,
      COUNT(r.id) as claimed
    FROM potluck_slots s
    LEFT JOIN potluck_rsvp r ON LOWER(r.dish) = LOWER(s.suggestion)
      AND r.potluck_id = s.potluck_id AND r.rsvp = 'yes'
    WHERE s.potluck_id = ?
    GROUP BY s.id ORDER BY s.sort_order ASC
  `).bind(pid).all();

  return new Response(JSON.stringify(slotsRes.results ?? []), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;

    // Validate slot availability if a dish was chosen
    if (b.dish && b.rsvp === 'yes') {
      const slot = await db.prepare(`
        SELECT s.max_claims, COUNT(r.id) as claimed
        FROM potluck_slots s
        LEFT JOIN potluck_rsvp r ON LOWER(r.dish) = LOWER(s.suggestion)
          AND r.potluck_id = s.potluck_id AND r.rsvp = 'yes'
        WHERE s.potluck_id = ? AND LOWER(s.suggestion) = LOWER(?)
        GROUP BY s.id
      `).bind(parseInt(b.potluckId ?? '1'), b.dish).first() as any;

      if (slot && slot.claimed >= slot.max_claims) {
        return new Response(JSON.stringify({ ok: false, error: 'slot_full' }), { status: 409 });
      }
    }

    await db.prepare(`
      INSERT INTO potluck_rsvp (potluck_id,name,handle,platforms,rsvp,guest_count,dish,dish_category,dietary,utensils,early_arrive,seating)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(parseInt(b.potluckId ?? '1'), b.name ?? '', b.handle ?? '', b.platforms ?? '',
      b.rsvp ?? '', parseInt(b.guestCount ?? '1'), b.dish ?? '', b.dishCategory ?? '',
      b.dietary ?? '', b.utensils ? 1 : 0, b.earlyArrive ? 1 : 0, b.seating ? 1 : 0).run();

    // Fire webhook
    const potluck = await db.prepare(`SELECT * FROM potlucks WHERE id=?`).bind(parseInt(b.potluckId ?? '1')).first() as any;
    const cfg = await db.prepare(`SELECT value FROM config WHERE key='webhook_url'`).first() as any;
    if (cfg?.value?.startsWith('http')) {
      fetch(cfg.value, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          potluck: potluck?.title ?? '', date: potluck?.date_label ?? '',
          name: b.name, handle: b.handle, platforms: b.platforms,
          rsvp: b.rsvp, guests: b.guestCount, dish: b.dish,
          category: b.dishCategory, dietary: b.dietary,
          utensils: b.utensils ? 'Yes' : 'No',
          early_arrive: b.earlyArrive ? 'Yes' : 'No',
          seating: b.seating ? 'Yes' : 'No',
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
