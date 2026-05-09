import type { APIRoute } from 'astro';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { getDB } from '../../../lib/db';
import { ensurePasskeySchema } from '../../../lib/passkey-schema';
import { ensureOrgSchema } from '../../../lib/admin-auth';
import { CHALLENGE_COOKIE, getRpConfig } from '../../../lib/passkey-config';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensureOrgSchema(db);
  await ensurePasskeySchema(db);

  const expectedChallenge = ctx.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!expectedChallenge) {
    return new Response(JSON.stringify({ error: 'challenge_expired' }), { status: 400 });
  }

  const body = await ctx.request.json() as { response: AuthenticationResponseJSON };
  const credentialId = body.response.id;

  const row = await db.prepare(`
    SELECT pk.id as pk_id, pk.public_key, pk.counter, pk.transports,
           o.id as org_id, o.name, o.email, o.plan, o.approved_for_potlucks
    FROM passkeys pk
    JOIN organizers o ON o.id = pk.organizer_id
    WHERE pk.credential_id = ?
  `).bind(credentialId).first() as any;

  if (!row || !row.approved_for_potlucks) {
    return new Response(JSON.stringify({ error: 'unknown_credential' }), { status: 400 });
  }

  const { rpID, origin } = getRpConfig(ctx.request);

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: credentialId,
        publicKey: new Uint8Array(Buffer.from(row.public_key, 'base64url')),
        counter: row.counter,
        transports: row.transports ? row.transports.split(',') : undefined,
      },
      requireUserVerification: false,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'verification_failed', detail: e.message }), { status: 400 });
  }

  if (!verification.verified) {
    return new Response(JSON.stringify({ error: 'not_verified' }), { status: 400 });
  }

  // Bump counter to prevent replay attacks
  await db.prepare("UPDATE passkeys SET counter = ? WHERE id = ?")
    .bind(verification.authenticationInfo.newCounter, row.pk_id).run();

  const sessionVal = encodeURIComponent(JSON.stringify({
    id: row.org_id, name: row.name, email: row.email, plan: row.plan,
  }));

  ctx.cookies.delete(CHALLENGE_COOKIE, { path: '/' });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Set-Cookie': `dsn_org=${sessionVal}; Path=/; Max-Age=${60*60*24*30}; HttpOnly; SameSite=Lax; Secure`,
      'Content-Type': 'application/json',
    },
  });
};
