import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensurePotluckSignupSchema } from '../../../lib/potluck-signup-schema';

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false, error: 'db_unavailable' }), { status: 500 });
  try {
    const b = await request.json() as any;
    const id = parseInt(String(b.id ?? ''));
    const signup_token = String(b.signup_token ?? '');
    if (!id || !signup_token) {
      return new Response(JSON.stringify({ ok: false, error: 'missing' }), { status: 400 });
    }
    await ensurePotluckSignupSchema(db);

    const row = await db.prepare(
      `SELECT id, potluck_id, signup_token, is_primary, dish_category
       FROM potluck_rsvp WHERE id=?`
    ).bind(id).first() as any;
    if (!row || row.signup_token !== signup_token) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_token' }), { status: 403 });
    }
    const potluck_id = row.potluck_id;

    // Delete branch: primary cascades to all rows under the same token.
    if (b.action === 'delete') {
      if (row.is_primary) {
        await db.prepare(
          `DELETE FROM potluck_rsvp WHERE potluck_id=? AND signup_token=?`
        ).bind(potluck_id, signup_token).run();
      } else {
        await db.prepare(`DELETE FROM potluck_rsvp WHERE id=?`).bind(id).run();
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Build update set.
    const fields: string[] = [];
    const binds: any[] = [];

    if (typeof b.dish === 'string') {
      const dish = b.dish.trim();
      if (!dish) {
        return new Response(JSON.stringify({ ok: false, error: 'empty_dish' }), { status: 400 });
      }
      fields.push('dish=?'); binds.push(dish);
    }

    if (typeof b.dish_category === 'string') {
      const newCat = b.dish_category.trim();
      if (!newCat) {
        return new Response(JSON.stringify({ ok: false, error: 'empty_category' }), { status: 400 });
      }
      // Re-check capacity only when category is actually changing.
      if (newCat !== row.dish_category) {
        const slot = await db.prepare(
          `SELECT max_claims FROM potluck_slots WHERE potluck_id=? AND category=? LIMIT 1`
        ).bind(potluck_id, newCat).first() as any;
        if (slot && slot.max_claims < 900) {
          const count = await db.prepare(
            `SELECT COUNT(*) as c FROM potluck_rsvp WHERE potluck_id=? AND dish_category=? AND rsvp='yes' AND id<>?`
          ).bind(potluck_id, newCat, id).first() as any;
          if ((count?.c ?? 0) >= slot.max_claims) {
            return new Response(JSON.stringify({ ok: false, error: 'slot_full' }), { status: 409 });
          }
        }
      }
      fields.push('dish_category=?'); binds.push(newCat);
    }

    if (b.guest_count != null) {
      if (!row.is_primary) {
        return new Response(JSON.stringify({ ok: false, error: 'guests_on_primary_only' }), { status: 400 });
      }
      const gc = Math.max(1, Math.min(20, parseInt(String(b.guest_count)) || 1));
      fields.push('guest_count=?'); binds.push(gc);
    }

    if (!fields.length) {
      return new Response(JSON.stringify({ ok: true, noop: true }), { headers: { 'Content-Type': 'application/json' } });
    }
    binds.push(id);
    await db.prepare(`UPDATE potluck_rsvp SET ${fields.join(', ')} WHERE id=?`).bind(...binds).run();
    return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
