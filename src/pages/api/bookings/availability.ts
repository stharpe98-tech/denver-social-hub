import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { canEditProfile } from '../../../lib/profile-auth';
import { ensureBookingsSchema } from '../../../lib/bookings-schema';

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function slugForOffering(db: D1Database, offeringId: number): Promise<string | null> {
  const row = await db.prepare(`SELECT profile_slug FROM bookable_offerings WHERE id=?`).bind(offeringId).first() as any;
  return row?.profile_slug || null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);

  let body: any;
  try { body = await request.json(); }
  catch { return j({ ok: false, error: 'Invalid body' }, 400); }

  const action = (body?.action || '').toString();

  if (action === 'list') {
    const offeringId = parseInt(body?.offering_id, 10);
    if (!Number.isFinite(offeringId)) return j({ ok: false, error: 'Missing offering_id' }, 400);
    const rows = (await db.prepare(
      `SELECT id, day_of_week, start_time, end_time, valid_from, valid_until
       FROM offering_availability WHERE offering_id=? ORDER BY day_of_week, start_time`
    ).bind(offeringId).all())?.results || [];
    return j({ ok: true, rules: rows });
  }

  if (action === 'create') {
    const offeringId = parseInt(body?.offering_id, 10);
    if (!Number.isFinite(offeringId)) return j({ ok: false, error: 'Missing offering_id' }, 400);
    const slug = await slugForOffering(db, offeringId);
    if (!slug) return j({ ok: false, error: 'Offering not found' }, 404);
    if (!(await canEditProfile(cookies, slug))) return j({ ok: false, error: 'Not authorized' }, 403);

    const dow = parseInt(body?.day_of_week, 10);
    if (!(dow >= 0 && dow <= 6)) return j({ ok: false, error: 'Invalid day_of_week' }, 400);
    const start = String(body?.start_time || '');
    const end = String(body?.end_time || '');
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return j({ ok: false, error: 'Invalid time (HH:MM)' }, 400);
    if (!(start < end)) return j({ ok: false, error: 'End must be after start' }, 400);
    const validFrom = body?.valid_from ? String(body.valid_from) : '';
    const validUntil = body?.valid_until ? String(body.valid_until) : '';
    if (validFrom && !DATE_RE.test(validFrom)) return j({ ok: false, error: 'Invalid valid_from' }, 400);
    if (validUntil && !DATE_RE.test(validUntil)) return j({ ok: false, error: 'Invalid valid_until' }, 400);

    const r = await db.prepare(
      `INSERT INTO offering_availability (offering_id, day_of_week, start_time, end_time, valid_from, valid_until)
       VALUES (?,?,?,?,?,?)`
    ).bind(offeringId, dow, start, end, validFrom, validUntil).run();
    return j({ ok: true, id: (r as any).meta?.last_row_id });
  }

  if (action === 'delete') {
    const id = parseInt(body?.id, 10);
    if (!Number.isFinite(id)) return j({ ok: false, error: 'Missing id' }, 400);
    const row = await db.prepare(
      `SELECT a.id, o.profile_slug FROM offering_availability a
       JOIN bookable_offerings o ON o.id = a.offering_id WHERE a.id=?`
    ).bind(id).first() as any;
    if (!row) return j({ ok: false, error: 'Not found' }, 404);
    if (!(await canEditProfile(cookies, row.profile_slug))) return j({ ok: false, error: 'Not authorized' }, 403);
    await db.prepare(`DELETE FROM offering_availability WHERE id=?`).bind(id).run();
    return j({ ok: true });
  }

  return j({ ok: false, error: 'Unknown action' }, 400);
};

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
