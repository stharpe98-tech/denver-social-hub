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
    if (!potluck_id || !signup_token || signup_token.length < 8) {
      return new Response(JSON.stringify({ ok: false, error: 'missing' }), { status: 400 });
    }
    await ensurePotluckSignupSchema(db);
    // Defense-in-depth: explicitly refuse empty / whitespace tokens so a
    // legacy row that somehow escaped the backfill can never be matched
    // by a caller sending '' or null.
    if (!signup_token.trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { headers: { 'Content-Type': 'application/json' } });
    }
    const { results } = await db.prepare(
      `SELECT id, name, dish, dish_category, guest_count, is_primary
       FROM potluck_rsvp
       WHERE potluck_id=? AND signup_token=? AND signup_token!='' AND signup_token IS NOT NULL AND rsvp='yes'
       ORDER BY is_primary DESC, created_at ASC`
    ).bind(potluck_id, signup_token).all();
    const signups = results ?? [];
    if (!signups.length) {
      return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ ok: true, signups }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
