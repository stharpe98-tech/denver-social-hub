import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensurePotluckSignupSchema } from '../../../lib/potluck-signup-schema';

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db_unavailable' }), { status: 500 });
  try {
    const b = await request.json() as any;
    const potluck_id = parseInt(String(b.potluck_id ?? ''));
    const signup_token = String(b.signup_token ?? '');
    const dish = String(b.dish ?? '').trim();
    const dish_category = String(b.dish_category ?? '').trim();
    if (!potluck_id || !signup_token || !dish || !dish_category) {
      return new Response(JSON.stringify({ ok: false, error: 'missing' }), { status: 400 });
    }
    await ensurePotluckSignupSchema(db);

    // Validate token corresponds to a primary row in this potluck.
    const primary = await db.prepare(
      `SELECT id, name, email, phone, handle, platforms
       FROM potluck_rsvp
       WHERE potluck_id=? AND signup_token=? AND is_primary=1 AND rsvp='yes'`
    ).bind(potluck_id, signup_token).first() as any;
    if (!primary) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 403 });
    }

    // Capacity check on category. Compare against potluck_slots.max_claims for
    // this category. If no slot row exists for the category (a "custom"
    // category typed by the user), treat capacity as unlimited.
    const slot = await db.prepare(
      `SELECT max_claims FROM potluck_slots WHERE potluck_id=? AND category=? LIMIT 1`
    ).bind(potluck_id, dish_category).first() as any;
    if (slot && slot.max_claims < 900) {
      const count = await db.prepare(
        `SELECT COUNT(*) as c FROM potluck_rsvp WHERE potluck_id=? AND dish_category=? AND rsvp='yes'`
      ).bind(potluck_id, dish_category).first() as any;
      if ((count?.c ?? 0) >= slot.max_claims) {
        return new Response(JSON.stringify({ ok: false, error: 'slot_full' }), { status: 409 });
      }
    }

    const res = await db.prepare(
      `INSERT INTO potluck_rsvp (potluck_id, name, email, phone, handle, platforms, rsvp, guest_count, dish, dish_category, signup_token, is_primary)
       VALUES (?,?,?,?,?,?, 'yes', 0, ?, ?, ?, 0)`
    ).bind(
      potluck_id,
      primary.name ?? '', primary.email ?? '', primary.phone ?? '',
      primary.handle ?? '', primary.platforms ?? '',
      dish, dish_category, signup_token,
    ).run();
    const newId = (res as any).meta?.last_row_id ?? null;
    return new Response(JSON.stringify({
      ok: true,
      signup: { id: newId, name: primary.name ?? '', dish, dish_category, guest_count: 0, is_primary: 0 },
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
