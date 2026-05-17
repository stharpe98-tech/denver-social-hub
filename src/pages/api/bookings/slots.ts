import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { ensureBookingsSchema, chopWindow, denverLocalToUtcIso, denverDow } from '../../../lib/bookings-schema';

// Public, GET-only. Returns generated slots in a date range.
// All slot_start / slot_end are ISO UTC. Visitors render in MT client-side.
// NOTE: This intentionally ignores DST edge cases per CLAUDE.md.

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);

  const offeringId = parseInt(url.searchParams.get('offering_id') || '', 10);
  const startYmd = url.searchParams.get('start') || '';
  const endYmd = url.searchParams.get('end') || '';
  if (!Number.isFinite(offeringId)) return j({ ok: false, error: 'Missing offering_id' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startYmd) || !/^\d{4}-\d{2}-\d{2}$/.test(endYmd)) {
    return j({ ok: false, error: 'Invalid date range' }, 400);
  }

  const offering = await db.prepare(
    `SELECT id, duration_min, archived FROM bookable_offerings WHERE id=?`
  ).bind(offeringId).first() as any;
  if (!offering || offering.archived) return j({ ok: true, slots: [] });

  const rules = ((await db.prepare(
    `SELECT day_of_week, start_time, end_time, valid_from, valid_until
     FROM offering_availability WHERE offering_id=?`
  ).bind(offeringId).all())?.results || []) as any[];

  // Existing bookings that occupy a slot (pending + confirmed).
  const taken = ((await db.prepare(
    `SELECT slot_start FROM bookings
     WHERE offering_id=? AND status IN ('pending','confirmed')
       AND slot_start >= ? AND slot_start <= ?`
  ).bind(offeringId, startYmd + 'T00:00:00Z', endYmd + 'T23:59:59Z').all())?.results || []) as any[];
  const takenSet = new Set<string>(taken.map(t => String(t.slot_start)));

  // Walk each day in range.
  const days = enumerateDates(startYmd, endYmd, 60); // hard cap 60 days
  const dur = parseInt(String(offering.duration_min), 10) || 30;
  const out: Array<{ slot_start: string; slot_end: string; available: boolean }> = [];

  for (const ymd of days) {
    // Determine Denver dow for this date by constructing midday UTC for that date,
    // then asking what Denver thinks the dow is.
    const middayIso = denverLocalToUtcIso(ymd, '12:00');
    const dow = denverDow(middayIso);
    for (const r of rules) {
      if (parseInt(String(r.day_of_week), 10) !== dow) continue;
      if (r.valid_from && ymd < String(r.valid_from)) continue;
      if (r.valid_until && ymd > String(r.valid_until)) continue;
      const chunks = chopWindow(String(r.start_time), String(r.end_time), dur);
      for (const c of chunks) {
        const startUtc = denverLocalToUtcIso(ymd, c.start);
        const endUtc = denverLocalToUtcIso(ymd, c.end);
        const available = !takenSet.has(startUtc) && new Date(startUtc).getTime() > Date.now();
        out.push({ slot_start: startUtc, slot_end: endUtc, available });
      }
    }
  }

  out.sort((a, b) => a.slot_start.localeCompare(b.slot_start));
  return j({ ok: true, slots: out });
};

function enumerateDates(startYmd: string, endYmd: string, cap: number): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startYmd.split('-').map(n => parseInt(n, 10));
  const [ey, em, ed] = endYmd.split('-').map(n => parseInt(n, 10));
  // Walk in UTC midnight; close enough for date enumeration since we only care about the YYYY-MM-DD label.
  let cur = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  for (let i = 0; i < cap && cur <= end; i++) {
    const d = new Date(cur);
    const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    out.push(ymd);
    cur += 86400000;
  }
  return out;
}

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
