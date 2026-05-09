import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureOrgSchema } from '../../../lib/admin-auth';
import {
  DEVICE_COOKIE, MAX_FAILED_ATTEMPTS,
  ensureTrustedDeviceSchema, hashDeviceToken, hashPin,
} from '../../../lib/pin-schema';

export const prerender = false;

// Logs in via PIN. Requires both a valid device cookie AND the right
// PIN. After MAX_FAILED_ATTEMPTS wrong PINs the device record is
// deleted and the user must re-authenticate via password / passkey /
// OTP to enroll again.
export const POST: APIRoute = async (ctx) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensureOrgSchema(db);
  await ensureTrustedDeviceSchema(db);

  const token = ctx.cookies.get(DEVICE_COOKIE)?.value;
  if (!token) {
    return new Response(JSON.stringify({ error: 'device_not_trusted' }), { status: 401 });
  }

  const body = await ctx.request.json().catch(() => ({})) as { pin?: string };
  const pin = (body.pin ?? '').trim();
  if (!/^\d{4,8}$/.test(pin)) {
    return new Response(JSON.stringify({ error: 'invalid_pin' }), { status: 400 });
  }

  const tokenHash = await hashDeviceToken(token);
  const row = await db.prepare(`
    SELECT td.id, td.pin_hash, td.pin_salt, td.failed_attempts,
           o.id as org_id, o.name, o.email, o.plan, o.approved_for_potlucks
    FROM trusted_devices td
    JOIN organizers o ON o.id = td.organizer_id
    WHERE td.device_token_hash = ?
  `).bind(tokenHash).first() as any;

  if (!row || !row.approved_for_potlucks) {
    // Clear the cookie so the client stops trying
    ctx.cookies.delete(DEVICE_COOKIE, { path: '/' });
    return new Response(JSON.stringify({ error: 'device_not_trusted' }), { status: 401 });
  }

  const candidate = await hashPin(pin, row.pin_salt);
  if (candidate !== row.pin_hash) {
    const newFails = (row.failed_attempts ?? 0) + 1;
    if (newFails >= MAX_FAILED_ATTEMPTS) {
      await db.prepare("DELETE FROM trusted_devices WHERE id = ?").bind(row.id).run();
      ctx.cookies.delete(DEVICE_COOKIE, { path: '/' });
      return new Response(JSON.stringify({ error: 'too_many_attempts' }), { status: 429 });
    }
    await db.prepare("UPDATE trusted_devices SET failed_attempts = ? WHERE id = ?").bind(newFails, row.id).run();
    return new Response(JSON.stringify({
      error: 'wrong_pin',
      attempts_remaining: MAX_FAILED_ATTEMPTS - newFails,
    }), { status: 401 });
  }

  // Success: reset attempt counter, stamp last_used_at, set session cookie
  await db.prepare("UPDATE trusted_devices SET failed_attempts = 0, last_used_at = ? WHERE id = ?")
    .bind(new Date().toISOString(), row.id).run();

  const sessionVal = encodeURIComponent(JSON.stringify({
    id: row.org_id, name: row.name, email: row.email, plan: row.plan,
  }));

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Set-Cookie': `dsn_org=${sessionVal}; Path=/; Max-Age=${60*60*24*30}; HttpOnly; SameSite=Lax; Secure`,
      'Content-Type': 'application/json',
    },
  });
};
