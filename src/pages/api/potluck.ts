import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { buildConfirmationEmail } from '../../lib/email';

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let token = '';
  for (let i = 0; i < 32; i++) token += chars[Math.floor(Math.random() * chars.length)];
  return token;
}

export const GET: APIRoute = async ({ url }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
  const pid = url.searchParams.get('id') || '1';
  const { results } = await db.prepare(`
    SELECT s.id, s.category, s.suggestion, s.max_claims, s.sort_order, COUNT(r.id) as claimed
    FROM potluck_slots s
    LEFT JOIN potluck_rsvp r ON LOWER(r.dish)=LOWER(s.suggestion)
      AND r.potluck_id=s.potluck_id AND r.rsvp='yes'
    WHERE s.potluck_id=? GROUP BY s.id ORDER BY s.sort_order ASC
  `).bind(pid).all();
  return new Response(JSON.stringify(results ?? []), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};

export const POST: APIRoute = async ({ request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;
    const potluckId = parseInt(b.potluckId ?? '1');

    // Validate slot
    if (b.dish && b.rsvp === 'yes') {
      const slot = await db.prepare(`
        SELECT s.max_claims, COUNT(r.id) as claimed
        FROM potluck_slots s
        LEFT JOIN potluck_rsvp r ON LOWER(r.dish)=LOWER(s.suggestion)
          AND r.potluck_id=s.potluck_id AND r.rsvp='yes'
        WHERE s.potluck_id=? AND LOWER(s.suggestion)=LOWER(?)
        GROUP BY s.id
      `).bind(potluckId, b.dish).first() as any;
      if (slot && slot.claimed >= slot.max_claims) {
        return new Response(JSON.stringify({ ok: false, error: 'slot_full' }), { status: 409 });
      }
    }

    const cancelToken = generateToken();
    await db.prepare(`
      INSERT INTO potluck_rsvp (potluck_id,name,email,handle,platforms,rsvp,guest_count,dish,dish_category,dietary,utensils,early_arrive,seating,cancel_token)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).bind(potluckId, b.name??'', b.email??'', b.handle??'', b.platforms??'', b.rsvp??'',
      parseInt(b.guestCount??'1'), b.dish??'', b.dishCategory??'', b.dietary??'',
      b.utensils?1:0, b.earlyArrive?1:0, b.seating?1:0, cancelToken).run();

    // Get config + potluck details
    const [potluck, cfgRows] = await Promise.all([
      db.prepare(`SELECT * FROM potlucks WHERE id=?`).bind(potluckId).first() as any,
      db.prepare(`SELECT key, value FROM config WHERE key IN ('resend_api_key','site_url','from_email')`).all(),
    ]);
    const cfg: Record<string,string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });

    const siteUrl = cfg.site_url || 'https://denversocialhub.com';
    const editUrl = `${siteUrl}/potlucks/edit?token=${cancelToken}`;
    const cancelUrl = `${siteUrl}/potlucks/cancel?token=${cancelToken}`;

    // Send confirmation email via Resend
    if (b.email && cfg.resend_api_key) {
      const html = buildConfirmationEmail({
        name: b.name ?? '',
        eventTitle: potluck?.title ?? '',
        eventDate: potluck?.date_label ?? '',
        eventTime: potluck?.time_label ?? '',
        eventLocation: potluck?.location ?? '',
        eventLocationDetail: potluck?.location_detail ?? '',
        dish: b.dish ?? '',
        guests: parseInt(b.guestCount ?? '1'),
        editUrl,
        cancelUrl,
      });
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cfg.resend_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
          to: [b.email],
          subject: `You're signed up for ${potluck?.title ?? 'the potluck'}! 🎉`,
          html,
        }),
      }).catch(() => {});
    }

    // Fire Zapier webhook
    const zapCfg = await db.prepare(`SELECT value FROM config WHERE key='webhook_url'`).first() as any;
    if (zapCfg?.value?.startsWith('http')) {
      fetch(zapCfg.value, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          potluck: potluck?.title ?? '', date: potluck?.date_label ?? '',
          name: b.name, email: b.email, platforms: b.platforms,
          rsvp: b.rsvp, guests: b.guestCount, dish: b.dish,
          category: b.dishCategory, dietary: b.dietary,
          utensils: b.utensils?'Yes':'No', early_arrive: b.earlyArrive?'Yes':'No', seating: b.seating?'Yes':'No',
          edit_url: editUrl, cancel_url: cancelUrl,
        }),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ ok: true, editUrl }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
