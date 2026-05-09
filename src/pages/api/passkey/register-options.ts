import type { APIRoute } from 'astro';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { getDB } from '../../../lib/db';
import { ensurePasskeySchema } from '../../../lib/passkey-schema';
import { requireApprovedOrg } from '../../../lib/admin-auth';
import { CHALLENGE_COOKIE, CHALLENGE_TTL_SECONDS, getRpConfig } from '../../../lib/passkey-config';

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

  const { rpID, rpName } = getRpConfig(ctx.request);

  const existing = await db.prepare("SELECT credential_id, transports FROM passkeys WHERE organizer_id = ?")
    .bind(org.id).all();
  const excludeCredentials = (existing.results ?? []).map((r: any) => ({
    id: r.credential_id,
    transports: r.transports ? r.transports.split(',') : undefined,
  }));

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(String(org.id)),
    userName: org.email,
    userDisplayName: org.name,
    attestationType: 'none',
    excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });

  ctx.cookies.set(CHALLENGE_COOKIE, options.challenge, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    maxAge: CHALLENGE_TTL_SECONDS,
  });

  return new Response(JSON.stringify(options), {
    headers: { 'Content-Type': 'application/json' },
  });
};
