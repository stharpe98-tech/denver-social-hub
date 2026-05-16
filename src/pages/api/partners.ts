// Partner submissions + admin moderation in one endpoint.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensurePartnersSchema, partnerSlug, PARTNER_CATEGORIES } from '../../lib/partners-schema';
import { isAdmin as isAdminCookie, getAdminEmail } from '../../lib/admin-auth';

export const prerender = false;

const VALID_CATEGORIES = new Set(PARTNER_CATEGORIES.map(c => c.key));

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return bad('db', 500);
  await ensurePartnersSchema(db);

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
      INSERT INTO partners (slug, business_name, category, neighborhood, offer_title, offer_details, redemption, website, contact_email, submitted_by_email, rsvp_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(slug, business_name, cat, neighborhood, offer_title, offer_details, redemption, website, contact_email, null, rsvp_threshold).run();

    return ok({ slug });
  }

  // Claim — open to everyone, bumps the counter on a click-through
  if (action === 'claim') {
    const id = parseInt(body.id);
    if (!id) return bad('id');
    await db.prepare("UPDATE partners SET claim_count = COALESCE(claim_count,0) + 1 WHERE id=? AND status='approved'").bind(id).run();
    return ok({});
  }

  // RSVP to a perk requires identity. Disabled while accounts are offline.
  if (action === 'rsvp') return bad('disabled', 200);

  // Admin actions — approve, decline, delete
  if (!(await isAdminCookie(cookies))) return bad('not_authorized', 403);
  const adminEmail = (await getAdminEmail(cookies)) || 'admin';

  const id = parseInt(body.id);
  if (!id) return bad('id');

  if (action === 'approve') {
    await db.prepare("UPDATE partners SET status='approved', reviewed_at=datetime('now'), reviewed_by=? WHERE id=?").bind(adminEmail, id).run();
    return ok({});
  }
  if (action === 'decline') {
    await db.prepare("UPDATE partners SET status='declined', reviewed_at=datetime('now'), reviewed_by=? WHERE id=?").bind(adminEmail, id).run();
    return ok({});
  }
  if (action === 'delete') {
    await db.prepare("DELETE FROM partners WHERE id=?").bind(id).run();
    return ok({});
  }

  return bad('unknown_action');
};
