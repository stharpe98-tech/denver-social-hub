import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { canEditProfile, validateSlug } from '../../../lib/profile-auth';
import { ensureBookingsSchema } from '../../../lib/bookings-schema';

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);

  let body: any;
  try { body = await request.json(); }
  catch { return j({ ok: false, error: 'Invalid body' }, 400); }

  const v = validateSlug(body?.slug || '');
  if (!v.ok) return j({ ok: false, error: v.error }, 400);
  if (!(await canEditProfile(cookies, v.slug))) return j({ ok: false, error: 'Not authorized' }, 403);

  const enabled = body?.enabled ? 1 : 0;
  await db.prepare(`UPDATE profiles SET has_booking_tool=? WHERE slug=?`).bind(enabled, v.slug).run();
  return j({ ok: true, enabled });
};

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
