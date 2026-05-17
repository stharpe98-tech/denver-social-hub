import type { APIRoute } from 'astro';
import { getDB } from '../../../lib/db';
import { canEditProfile, validateSlug } from '../../../lib/profile-auth';
import { ensureBookingsSchema } from '../../../lib/bookings-schema';

function clamp(n: any, min: number, max: number, fallback: number): number {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

function s(v: any, max = 500): string {
  return (v == null ? '' : String(v)).slice(0, max);
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
    const v = validateSlug(body?.slug || '');
    if (!v.ok) return j({ ok: false, error: v.error }, 400);
    return doList(db, v.slug);
  }

  // All mutations require the editor cookie.
  const slugCandidate = (body?.slug || '').toString();
  let editorSlug = '';
  if (slugCandidate) {
    const v = validateSlug(slugCandidate);
    if (v.ok) editorSlug = v.slug;
  }
  // If only id is provided, look up the slug from the offering row.
  if (!editorSlug && (action === 'update' || action === 'archive' || action === 'unarchive')) {
    const id = parseInt(body?.id, 10);
    if (Number.isFinite(id)) {
      const row = await db.prepare(`SELECT profile_slug FROM bookable_offerings WHERE id=?`).bind(id).first() as any;
      if (row && row.profile_slug) editorSlug = String(row.profile_slug);
    }
  }
  if (!editorSlug) return j({ ok: false, error: 'Missing slug' }, 400);
  if (!(await canEditProfile(cookies, editorSlug))) return j({ ok: false, error: 'Not authorized' }, 403);

  if (action === 'create') {
    const title = s(body?.title, 120).trim();
    if (!title) return j({ ok: false, error: 'Title required' }, 400);
    const description = s(body?.description, 2000);
    const duration_min = clamp(body?.duration_min, 5, 480, 30);
    const price_text = s(body?.price_text, 60);
    const capacity = clamp(body?.capacity_per_slot, 1, 100, 1);
    const r = await db.prepare(
      `INSERT INTO bookable_offerings (profile_slug, title, description, duration_min, price_text, capacity_per_slot)
       VALUES (?,?,?,?,?,?)`
    ).bind(editorSlug, title, description, duration_min, price_text, capacity).run();
    return j({ ok: true, id: (r as any).meta?.last_row_id });
  }

  if (action === 'update') {
    const id = parseInt(body?.id, 10);
    if (!Number.isFinite(id)) return j({ ok: false, error: 'Missing id' }, 400);
    const sets: string[] = [];
    const args: any[] = [];
    if (body?.title != null)             { sets.push('title=?');             args.push(s(body.title, 120)); }
    if (body?.description != null)       { sets.push('description=?');       args.push(s(body.description, 2000)); }
    if (body?.duration_min != null)      { sets.push('duration_min=?');      args.push(clamp(body.duration_min, 5, 480, 30)); }
    if (body?.price_text != null)        { sets.push('price_text=?');        args.push(s(body.price_text, 60)); }
    if (body?.capacity_per_slot != null) { sets.push('capacity_per_slot=?'); args.push(clamp(body.capacity_per_slot, 1, 100, 1)); }
    if (!sets.length) return j({ ok: true });
    args.push(id, editorSlug);
    await db.prepare(`UPDATE bookable_offerings SET ${sets.join(', ')} WHERE id=? AND profile_slug=?`).bind(...args).run();
    return j({ ok: true });
  }

  if (action === 'archive') {
    const id = parseInt(body?.id, 10);
    if (!Number.isFinite(id)) return j({ ok: false, error: 'Missing id' }, 400);
    await db.prepare(`UPDATE bookable_offerings SET archived=1 WHERE id=? AND profile_slug=?`).bind(id, editorSlug).run();
    return j({ ok: true });
  }

  if (action === 'unarchive') {
    const id = parseInt(body?.id, 10);
    if (!Number.isFinite(id)) return j({ ok: false, error: 'Missing id' }, 400);
    await db.prepare(`UPDATE bookable_offerings SET archived=0 WHERE id=? AND profile_slug=?`).bind(id, editorSlug).run();
    return j({ ok: true });
  }

  return j({ ok: false, error: 'Unknown action' }, 400);
};

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return j({ ok: false, error: 'DB unavailable' }, 500);
  await ensureBookingsSchema(db);
  const slug = url.searchParams.get('slug') || '';
  const v = validateSlug(slug);
  if (!v.ok) return j({ ok: false, error: v.error }, 400);
  return doList(db, v.slug);
};

async function doList(db: D1Database, slug: string) {
  const rows = (await db.prepare(
    `SELECT id, title, description, duration_min, price_text, capacity_per_slot, archived, created_at
     FROM bookable_offerings WHERE profile_slug=? ORDER BY archived ASC, id ASC`
  ).bind(slug).all())?.results || [];
  return j({ ok: true, offerings: rows });
}

function j(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
