import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import {
  DEVICE_COOKIE,
  ensureTrustedDeviceSchema, hashDeviceToken,
} from '../../../lib/pin-schema';

export const prerender = false;

// Tells the login UI whether this browser is enrolled. Returns the
// matching organizer's email so we can prefill the form. Doesn't leak
// anything an attacker couldn't already get from a stolen cookie.
export const GET: APIRoute = async (ctx) => {
  const token = ctx.cookies.get(DEVICE_COOKIE)?.value;
  if (!token) return new Response(JSON.stringify({ trusted: false }), { headers: { 'Content-Type': 'application/json' } });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ trusted: false }), { headers: { 'Content-Type': 'application/json' } });
  await ensureTrustedDeviceSchema(db);

  const hash = await hashDeviceToken(token);
  const row = await db.prepare(`
    SELECT o.email, o.name, o.approved_for_potlucks
    FROM trusted_devices td
    JOIN organizers o ON o.id = td.organizer_id
    WHERE td.device_token_hash = ?
  `).bind(hash).first() as any;

  if (!row || !row.approved_for_potlucks) {
    return new Response(JSON.stringify({ trusted: false }), { headers: { 'Content-Type': 'application/json' } });
  }
  return new Response(JSON.stringify({
    trusted: true,
    email: row.email,
    name: row.name,
  }), { headers: { 'Content-Type': 'application/json' } });
};
