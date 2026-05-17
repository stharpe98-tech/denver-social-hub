// Returns public-card data for a single profile, plus the relationship
// state between the viewer (via dsn_profile_<slug>) and the target.
// Used by the global member-card modal in Base.astro.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePhoneRequestsSchema } from '../../lib/phone-requests-schema';
import { getCurrentProfile } from '../../lib/profile-auth';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const GET: APIRoute = async ({ url, request, cookies }) => {
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email.includes('@')) return bad('email');

  const db = getDB();
  if (!db) return bad('db', 500);

  // Look up the target by their live profile row.
  const target: any = await db.prepare(
    `SELECT slug, display_name, email, headline, bio, neighborhood, photo_emoji, tier, created_at
       FROM profiles
      WHERE LOWER(email) = ? AND status = 'live' LIMIT 1`
  ).bind(email).first();
  if (!target) return bad('not_found', 404);
  const targetTier: 'regular' | 'organizer' = target.tier === 'organizer' ? 'organizer' : 'regular';

  // Viewer (may be null — non-profile viewers still get the public card,
  // they just see a "get a /u/ page" CTA instead of message/phone buttons).
  const viewer = await getCurrentProfile(cookies, db, request);

  let phoneRequest: { sent: any; received: any } | null = null;
  if (viewer) {
    await ensurePhoneRequestsSchema(db);
    const sent: any = await db.prepare(
      'SELECT id, status, shared_phone FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? ORDER BY id DESC LIMIT 1'
    ).bind(viewer.email, email).first();
    const received: any = await db.prepare(
      'SELECT id, status FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? ORDER BY id DESC LIMIT 1'
    ).bind(email, viewer.email).first();
    phoneRequest = { sent: sent || null, received: received || null };
  }

  return ok({
    member: {
      slug: target.slug,
      email: target.email,
      name: target.display_name || target.slug,
      display_name: target.display_name || target.slug,
      headline: target.headline || '',
      bio: target.bio || '',
      neighborhood: target.neighborhood || '',
      photo_emoji: target.photo_emoji || '',
      tier: targetTier,
      joined_at: target.created_at || null,
    },
    viewer: viewer ? { slug: viewer.slug, email: viewer.email, display_name: viewer.display_name } : null,
    isSelf: viewer ? viewer.slug === target.slug : false,
    phoneRequest,
  });
};
