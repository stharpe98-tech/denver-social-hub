// Returns public-card data for a single member, plus the relationship
// status between the viewer and the target (mutual groups, pending
// phone request, etc). Used by the global member-card modal.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePhoneRequestsSchema } from '../../lib/phone-requests-schema';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const GET: APIRoute = async ({ url, cookies }) => {
  const email = (url.searchParams.get('email') || '').trim().toLowerCase();
  if (!email.includes('@')) return bad('email');

  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) return bad('not_signed_in', 401);
  const me = (user.email || '').toLowerCase();

  const db = getDB();
  if (!db) return bad('db', 500);
  await ensurePhoneRequestsSchema(db);

  const m: any = await db.prepare(
    'SELECT email, name, bio, neighborhood, joined_at, reddit_username, discord_username, karma, extra_role FROM members WHERE LOWER(email)=?'
  ).bind(email).first();
  if (!m) return bad('not_found', 404);

  // Mutual groups
  let mutualGroups: any[] = [];
  try {
    const g = await db.prepare(`
      SELECT g.name, g.slug
      FROM group_members gm1
      JOIN group_members gm2 ON gm1.group_id = gm2.group_id
      JOIN groups g ON g.id = gm1.group_id
      WHERE LOWER(gm1.member_email)=? AND LOWER(gm2.member_email)=?
      LIMIT 6
    `).bind(me, email).all();
    mutualGroups = (g?.results || []) as any[];
  } catch {}

  // Phone request status (both directions)
  const sent: any = await db.prepare(
    'SELECT id, status, shared_phone FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? ORDER BY id DESC LIMIT 1'
  ).bind(me, email).first();
  const received: any = await db.prepare(
    'SELECT id, status FROM phone_requests WHERE LOWER(from_email)=? AND LOWER(to_email)=? ORDER BY id DESC LIMIT 1'
  ).bind(email, me).first();

  return ok({
    member: {
      email: m.email,
      name: m.name || (m.email || '').split('@')[0],
      bio: m.bio || '',
      neighborhood: m.neighborhood || '',
      joined_at: m.joined_at || null,
      reddit_username: m.reddit_username || '',
      discord_username: m.discord_username || '',
      extra_role: m.extra_role || '',
    },
    mutualGroups,
    phoneRequest: { sent, received },
    isSelf: me === email,
  });
};
