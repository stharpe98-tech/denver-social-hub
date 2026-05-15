// Partner submissions + admin moderation in one endpoint.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePartnersSchema, partnerSlug, PARTNER_CATEGORIES } from '../../lib/partners-schema';

export const prerender = false;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';
const VALID_CATEGORIES = new Set(PARTNER_CATEGORIES.map(c => c.key));

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return bad('db', 500);
  await ensurePartnersSchema(db);

  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;

  // Anyone (including signed-out visitors) can submit a perk — we want
  // a low-friction "tell us about your offer" funnel.
  if (action === 'submit') {
    const business_name = String(body.business_name || '').trim();
    const offer_title = String(body.offer_title || '').trim();
    const offer_details = String(body.offer_details || '').trim();
    const redemption = String(body.redemption || '').trim();
    const contact_email = String(body.contact_email || '').trim().toLowerCase();
    const category = String(body.category || 'other').toLowerCase();
    const neighborhood = String(body.neighborhood || '').trim();
    const website = String(body.website || '').trim();
    const booking_url_raw = String(body.booking_url || '').trim();
    const booking_url = /^https?:\/\//i.test(booking_url_raw) ? booking_url_raw : '';
    const thresholdRaw = parseInt(body.rsvp_threshold);
    const rsvp_threshold = Number.isFinite(thresholdRaw) && thresholdRaw > 0 ? Math.min(thresholdRaw, 500) : 0;

    if (business_name.length < 2) return bad('business_name');
    if (offer_title.length < 3) return bad('offer_title');
    if (!contact_email.includes('@')) return bad('contact_email');
    const cat = VALID_CATEGORIES.has(category) ? category : 'other';

    let slug = partnerSlug(business_name);
    let n = 2;
    while (await db.prepare('SELECT 1 FROM partners WHERE slug=?').bind(slug).first()) {
      slug = `${partnerSlug(business_name)}-${n++}`;
      if (n > 50) return bad('slug_exhausted');
    }

    await db.prepare(`
      INSERT INTO partners (slug, business_name, category, neighborhood, offer_title, offer_details, redemption, website, contact_email, submitted_by_email, rsvp_threshold, booking_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(slug, business_name, cat, neighborhood, offer_title, offer_details, redemption, website, contact_email, user?.email || null, rsvp_threshold, booking_url || null).run();

    return ok({ slug });
  }

  // Claim — open to everyone, bumps the counter on a click-through
  if (action === 'claim') {
    const id = parseInt(body.id);
    if (!id) return bad('id');
    await db.prepare("UPDATE partners SET claim_count = COALESCE(claim_count,0) + 1 WHERE id=? AND status='approved'").bind(id).run();
    return ok({});
  }

  // RSVP to a perk — must be signed in so we have an identity to dedupe on.
  // Unique constraint on (partner_id, user_email) is what stops one person
  // from inflating the count past the threshold.
  if (action === 'rsvp') {
    if (!user?.email) return bad('login_required', 401);
    const id = parseInt(body.id);
    if (!id) return bad('id');
    const email = String(user.email).toLowerCase();
    const partner = await db.prepare("SELECT id, rsvp_threshold FROM partners WHERE id=? AND status='approved'").bind(id).first() as any;
    if (!partner) return bad('not_found', 404);

    const ins = await db.prepare("INSERT OR IGNORE INTO perk_rsvps (partner_id, user_email) VALUES (?, ?)").bind(id, email).run();
    const inserted = (ins.meta as any)?.changes > 0;
    if (inserted) {
      await db.prepare("UPDATE partners SET rsvp_count = COALESCE(rsvp_count,0) + 1 WHERE id=?").bind(id).run();
    }
    const fresh = await db.prepare("SELECT rsvp_count, rsvp_threshold FROM partners WHERE id=?").bind(id).first() as any;
    const count = fresh?.rsvp_count || 0;
    const threshold = fresh?.rsvp_threshold || 0;
    return ok({ count, threshold, unlocked: threshold === 0 || count >= threshold, already: !inserted });
  }

  // Admin actions — approve, decline, delete
  const isSuperAdmin = (user?.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;
  const isAdmin = isSuperAdmin || user?.role === 'admin';
  if (!isAdmin) return bad('not_authorized', 403);

  const id = parseInt(body.id);
  if (!id) return bad('id');

  if (action === 'approve') {
    await db.prepare("UPDATE partners SET status='approved', reviewed_at=datetime('now'), reviewed_by=? WHERE id=?").bind(user.email, id).run();
    return ok({});
  }
  if (action === 'decline') {
    await db.prepare("UPDATE partners SET status='declined', reviewed_at=datetime('now'), reviewed_by=? WHERE id=?").bind(user.email, id).run();
    return ok({});
  }
  if (action === 'delete') {
    await db.prepare("DELETE FROM partners WHERE id=?").bind(id).run();
    return ok({});
  }

  return bad('unknown_action');
};
