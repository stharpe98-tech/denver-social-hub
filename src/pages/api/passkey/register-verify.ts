import type { APIRoute } from 'astro';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { getDB } from '../../../lib/db';
import { ensurePasskeySchema } from '../../../lib/passkey-schema';
import { requireApprovedOrg } from '../../../lib/admin-auth';
import { CHALLENGE_COOKIE, getRpConfig } from '../../../lib/passkey-config';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const gate = await requireApprovedOrg(ctx as any);
  if (gate instanceof Response) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  }
  const org = gate;

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensurePasskeySchema(db);

  const expectedChallenge = ctx.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return new Response(JSON.stringify({ error: 'challenge_expired' }), { status: 400 });
  }

  const { rpID, origin } = getRpConfig(ctx.request);
  const body = await ctx.request.json() as { response: RegistrationResponseJSON; deviceLabel?: string };

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'verification_failed', detail: e.message }), { status: 400 });
  }

  if (!verification.verified || !verification.registrationInfo) {
    return new Response(JSON.stringify({ error: 'not_verified' }), { status: 400 });
  }

  const { credential } = verification.registrationInfo;
  const transports = body.response.response.transports?.join(',') || null;

  await db.prepare(
    "INSERT INTO passkeys (organizer_id, credential_id, public_key, counter, transports, device_label, created_at) VALUES (?,?,?,?,?,?,?)"
  ).bind(
    org.id,
    credential.id,
    Buffer.from(credential.publicKey).toString('base64url'),
    credential.counter,
    transports,
    (body.deviceLabel ?? '').slice(0, 64) || null,
    new Date().toISOString(),
  ).run();

  ctx.cookies.delete(CHALLENGE_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
