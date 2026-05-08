import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { buildConfirmationEmail } from '../../lib/email';

function generateToken(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 32; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

async function verifyTurnstile(token: string, secret: string, ip: string): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await res.json() as { success: boolean };
    return data.success;
  } catch { return false; }
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

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ ok: false }), { status: 500 });
  try {
    const b = await request.json() as Record<string, any>;

    // Honeypot check — bots fill hidden fields, humans don't
    if (b._gotcha && b._gotcha.length > 0) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Turnstile verification
    const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
    const cfg: Record<string,string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });

    if (cfg.turnstile_secret_key && b._turnstile) {
      const valid = await verifyTurnstile(b._turnstile, cfg.turnstile_secret_key, clientAddress || '');
      if (!valid) {
        return new Response(JSON.stringify({ ok: false, error: 'bot_detected' }), { status: 403 });
      }
    }

    const potluckId = parseInt(b.potluckId ?? '1');

    // Slot validation
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

    const potluck = await db.prepare(`SELECT * FROM potlucks WHERE id=?`).bind(potluckId).first() as any;
    const siteUrl = cfg.site_url || 'https://denversocialhub.com';
    const editUrl = `${siteUrl}/potlucks/edit?token=${cancelToken}`;
    const cancelUrl = `${siteUrl}/potlucks/edit?token=${cancelToken}&action=cancel`;

    // Send confirmation email
    if (b.email && cfg.resend_api_key) {
      const html = buildConfirmationEmail({
        name: b.name ?? '', eventTitle: potluck?.title ?? '',
        eventDate: potluck?.date_label ?? '', eventTime: potluck?.time_label ?? '',
        eventLocation: potluck?.location ?? '', eventLocationDetail: potluck?.location_detail ?? '',
        dish: b.dish ?? '', guests: parseInt(b.guestCount ?? '1'),
        editUrl, cancelUrl,
      });
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
          to: [b.email],
          subject: `You're signed up for ${potluck?.title ?? 'the potluck'}! 🎉`,
          html,
        }),
      }).catch(() => {});
    }

    // Organizer notification email
    const orgEmail = cfg.organizer_email || potluck?.organizer_email;
    if (orgEmail && cfg.resend_api_key && b.rsvp === 'yes') {
      const orgHtml = `<div style="font-family:sans-serif;max-width:500px;padding:20px">
        <h2 style="color:#c2410c">New sign-up: ${potluck?.title}</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#57524c;width:120px">Name</td><td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-weight:600">${b.name}</td></tr>
          ${b.dish ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#57524c">Bringing</td><td style="padding:8px 0;border-bottom:1px solid #f0ede8;font-weight:600">${b.dish}</td></tr>` : ''}
          <tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#57524c">Guests</td><td style="padding:8px 0;border-bottom:1px solid #f0ede8">${b.guestCount}</td></tr>
          ${b.email ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f0ede8;color:#57524c">Email</td><td style="padding:8px 0;border-bottom:1px solid #f0ede8">${b.email}</td></tr>` : ''}
          ${b.platforms ? `<tr><td style="padding:8px 0;color:#57524c">Found via</td><td style="padding:8px 0">${b.platforms}</td></tr>` : ''}
        </table>
        <p style="margin-top:16px;font-size:13px;color:#a09890">Total coming: check your admin panel at /potlucks/manage/${potluckId}</p>
      </div>`;
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.resend_api_key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: cfg.from_email || 'Denver Social <noreply@denversocialhub.com>',
          to: [orgEmail],
          subject: `New sign-up: ${b.name} is coming to ${potluck?.title}${b.dish ? ` — bringing ${b.dish}` : ''}`,
          html: orgHtml,
        }),
      }).catch(() => {});
    }

    // Zapier webhook
    if (cfg.webhook_url?.startsWith('http')) {
      fetch(cfg.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(), potluck: potluck?.title ?? '',
          name: b.name, email: b.email, platforms: b.platforms,
          rsvp: b.rsvp, guests: b.guestCount, dish: b.dish,
          edit_url: editUrl, cancel_url: cancelUrl,
        }),
      }).catch(() => {});
    }

    // Return contact info securely in response (never in HTML source)
    const contact = {
      phone: cfg.contact_phone || '',
      discord: cfg.contact_discord || '',
      discord_url: cfg.contact_discord_url || '',
      venmo: cfg.venmo_handle || '',
      stripe_link: cfg.stripe_link || '',
      cashapp_handle: cfg.cashapp_handle || '',
    };
    return new Response(JSON.stringify({ ok: true, editUrl, contact }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
  }
};
