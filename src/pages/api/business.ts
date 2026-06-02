import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../lib/db';
import { ensureBusinessSchema, BUSINESS_CATEGORY_KEYS, LISTING_TYPE_KEYS } from '../../lib/business-schema';

export const prerender = false;

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
function randomHex(n: number): string {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}
function clean(v: any, max: number): string {
  return String(v ?? '').trim().slice(0, max);
}
// Pull the R2 object key out of a stored logo URL like
// "/api/profile/img/u/biz/<hex>.png" so we can clean it up on delete.
function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = String(url).match(/\/api\/profile\/img\/(u\/biz\/[^?#]+)/);
  return m ? m[1] : null;
}

// GET /api/business?id=<n> — public listing fetch (used to prefill the edit form)
export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return json(500, { ok: false, error: 'DB unavailable' });
  await ensureBusinessSchema(db);
  const id = parseInt(url.searchParams.get('id') || '', 10);
  if (!id) return json(400, { ok: false, error: 'Missing id' });
  const row: any = await db.prepare(
    `SELECT id, owner_name, name, category, listing_type, tagline, description, phone, email, website, instagram, neighborhood, logo_url, status
     FROM business_listings WHERE id=?`
  ).bind(id).first();
  if (!row || row.status !== 'active') return json(404, { ok: false, error: 'Not found' });
  return json(200, { ok: true, listing: row });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return json(500, { ok: false, error: 'DB unavailable' });
  await ensureBusinessSchema(db);

  let body: any;
  try { body = await request.json(); }
  catch { return json(400, { ok: false, error: 'Bad request' }); }

  const action = String(body.action || 'create');

  // ── DELETE ──────────────────────────────────────────
  if (action === 'delete') {
    const id = parseInt(String(body.id || ''), 10);
    const token = clean(body.edit_token, 80);
    if (!id || !token) return json(400, { ok: false, error: 'Missing id or token' });
    const row: any = await db.prepare(
      `SELECT id, edit_token, logo_url FROM business_listings WHERE id=?`
    ).bind(id).first();
    if (!row) return json(404, { ok: false, error: 'Not found' });
    if (row.edit_token !== token) return json(403, { ok: false, error: 'Not authorized' });
    await db.prepare(`DELETE FROM business_listings WHERE id=?`).bind(id).run();
    const k = keyFromUrl(row.logo_url);
    if (k) { try { await ((env as any).UPLOADS as R2Bucket).delete(k); } catch {} }
    return json(200, { ok: true });
  }

  // Honeypot — bots fill hidden fields.
  if (clean(body._gotcha, 50)) return json(200, { ok: true, id: 0 });

  // Shared field validation for create + update.
  const name = clean(body.name, 80);
  const category = clean(body.category, 30);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 120);
  if (!name) return json(400, { ok: false, error: 'Business name required' });
  if (!BUSINESS_CATEGORY_KEYS.includes(category)) return json(400, { ok: false, error: 'Pick a category' });
  if (!phone && !email) return json(400, { ok: false, error: 'Add a phone or email so people can reach you' });

  const listing_type = LISTING_TYPE_KEYS.includes(clean(body.listing_type, 20)) ? clean(body.listing_type, 20) : 'business';

  const fields = {
    name,
    category,
    listing_type,
    tagline: clean(body.tagline, 120),
    description: clean(body.description, 1200),
    phone,
    email,
    website: clean(body.website, 200),
    instagram: clean(body.instagram, 80).replace(/^@/, ''),
    neighborhood: clean(body.neighborhood, 60),
    logo_url: clean(body.logo_url, 300),
  };

  // ── UPDATE ──────────────────────────────────────────
  if (action === 'update') {
    const id = parseInt(String(body.id || ''), 10);
    const token = clean(body.edit_token, 80);
    if (!id || !token) return json(400, { ok: false, error: 'Missing id or token' });
    const row: any = await db.prepare(`SELECT id, edit_token FROM business_listings WHERE id=?`).bind(id).first();
    if (!row) return json(404, { ok: false, error: 'Not found' });
    if (row.edit_token !== token) return json(403, { ok: false, error: 'Not authorized' });
    await db.prepare(
      `UPDATE business_listings SET name=?, category=?, listing_type=?, tagline=?, description=?, phone=?, email=?, website=?, instagram=?, neighborhood=?, logo_url=? WHERE id=?`
    ).bind(
      fields.name, fields.category, fields.listing_type, fields.tagline, fields.description,
      fields.phone, fields.email, fields.website, fields.instagram,
      fields.neighborhood, fields.logo_url, id
    ).run();
    return json(200, { ok: true, id });
  }

  // ── CREATE ──────────────────────────────────────────
  const ownerEmail = clean(body.email, 120) || clean(body.owner_email, 120);
  const ownerName = clean(body.owner_name, 80) || clean(body.name, 80);
  const editToken = randomHex(16);
  const res = await db.prepare(
    `INSERT INTO business_listings
       (owner_email, owner_name, name, category, listing_type, tagline, description, phone, email, website, instagram, neighborhood, logo_url, edit_token, status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active')`
  ).bind(
    ownerEmail, ownerName, fields.name, fields.category, fields.listing_type, fields.tagline,
    fields.description, fields.phone, fields.email, fields.website,
    fields.instagram, fields.neighborhood, fields.logo_url, editToken
  ).run();

  const id = res.meta?.last_row_id;
  return json(200, { ok: true, id, edit_token: editToken });
};
