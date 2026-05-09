import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { requireApprovedOrg } from '../../../lib/admin-auth';
import {
  DEVICE_COOKIE, DEVICE_COOKIE_TTL_SECONDS,
  ensureTrustedDeviceSchema, generateDeviceToken, generatePinSalt,
  hashDeviceToken, hashPin,
} from '../../../lib/pin-schema';

export const prerender = false;

// Sets (or replaces) a PIN for the current device. Requires an active
// organizer session, so the only way to enroll a device is via a real
// login first.
export const POST: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const org = gate;

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensureTrustedDeviceSchema(db);

  const body = await ctx.request.json() as { pin?: string; deviceLabel?: string };
  const pin = (body.pin ?? '').trim();
  if (!/^\d{4,8}$/.test(pin)) {
    return new Response(JSON.stringify({ error: 'pin_must_be_4_to_8_digits' }), { status: 400 });
  }

  // Reuse existing device record if one is already set on this browser
  const existingToken = ctx.cookies.get(DEVICE_COOKIE)?.value;
  const salt = generatePinSalt();
  const pinHash = await hashPin(pin, salt);

  if (existingToken) {
    const existingHash = await hashDeviceToken(existingToken);
    const row = await db.prepare(
      "SELECT id, organizer_id FROM trusted_devices WHERE device_token_hash = ?"
    ).bind(existingHash).first() as any;
    if (row && row.organizer_id === org.id) {
      await db.prepare(
        "UPDATE trusted_devices SET pin_hash = ?, pin_salt = ?, failed_attempts = 0, device_label = ?, last_used_at = ? WHERE id = ?"
      ).bind(pinHash, salt, (body.deviceLabel ?? '').slice(0, 64) || null, new Date().toISOString(), row.id).run();
      return new Response(JSON.stringify({ ok: true, replaced: true }), { headers: { 'Content-Type': 'application/json' } });
    }
  }

  // Create a fresh device record
  const newToken = generateDeviceToken();
  const newTokenHash = await hashDeviceToken(newToken);
  await db.prepare(
    "INSERT INTO trusted_devices (organizer_id, device_token_hash, pin_hash, pin_salt, device_label, created_at) VALUES (?,?,?,?,?,?)"
  ).bind(
    org.id, newTokenHash, pinHash, salt,
    (body.deviceLabel ?? '').slice(0, 64) || null,
    new Date().toISOString(),
  ).run();

  ctx.cookies.set(DEVICE_COOKIE, newToken, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: DEVICE_COOKIE_TTL_SECONDS,
  });

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
