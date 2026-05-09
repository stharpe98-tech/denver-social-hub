import type { APIRoute } from 'astro';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { getDB } from '../../../lib/db';
import { ensurePasskeySchema } from '../../../lib/passkey-schema';
import { ensureOrgSchema } from '../../../lib/admin-auth';
import { CHALLENGE_COOKIE, CHALLENGE_TTL_SECONDS, getRpConfig } from '../../../lib/passkey-config';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'db_unavailable' }), { status: 500 });
  await ensureOrgSchema(db);
  await ensurePasskeySchema(db);

  const { rpID } = getRpConfig(ctx.request);
  const body = await ctx.request.json().catch(() => ({})) as { email?: string };

  let allowCredentials: { id: string; transports?: any[] }[] | undefined;
  if (body.email) {
    const email = body.email.trim().toLowerCase();
    const org = await db.prepare(
      "SELECT id FROM organizers WHERE LOWER(email) = ? AND approved_for_potlucks = 1"
    ).bind(email).first() as any;
    if (org) {
      const rows = await db.prepare(
        "SELECT credential_id, transports FROM passkeys WHERE organizer_id = ?"
      ).bind(org.id).all();
      allowCredentials = (rows.results ?? []).map((r: any) => ({
        id: r.credential_id,
        transports: r.transports ? r.transports.split(',') : undefined,
      }));
    }
    // If org doesn't exist or has no passkeys, fall through to undefined
    // (discoverable creds). This avoids leaking which emails are admins.
  }

  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: 'preferred',
    allowCredentials,
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
