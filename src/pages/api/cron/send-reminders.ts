import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin-auth';

function tomorrowYMD(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

export const POST: APIRoute = async (ctx) => {
  // Auth: bearer token OR admin cookie.
  const auth = ctx.request.headers.get('authorization') || '';
  const secret = ((env as any)?.CRON_SECRET as string | undefined) || '';
  const bearerOk = !!secret && auth === `Bearer ${secret}`;
  const cookieOk = await isAdmin(ctx.cookies);
  if (!bearerOk && !cookieOk) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = getDB();
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'db_unavailable' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const cfgRows = await db.prepare(`SELECT key, value FROM config`).all();
  const cfg: Record<string, string> = {};
  (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
  const resendKey = cfg.resend_api_key;
  const fromEmail = cfg.from_email || 'Denver Social <onboarding@resend.dev>';
  const siteUrl = cfg.site_url || 'https://denversocialhub.com';

  if (!resendKey) {
    return new Response(JSON.stringify({ ok: false, error: 'resend_api_key not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const target = tomorrowYMD();

  let rows: any[] = [];
  try {
    const r = await db.prepare(`
      SELECT r.id, r.name, r.email, r.cancel_token,
             p.title, p.event_date, p.date_label, p.time_label, p.location
      FROM potluck_rsvp r
      JOIN potlucks p ON p.id = r.potluck_id
      WHERE p.event_date = ?
        AND r.rsvp = 'yes'
        AND r.reminder_sent_at IS NULL
        AND r.email IS NOT NULL
        AND r.email != ''
    `).bind(target).all();
    rows = (r.results ?? []) as any[];
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const subject = `Reminder: ${row.title} is tomorrow`;
    const cancelUrl = `${siteUrl}/potlucks/edit?token=${encodeURIComponent(row.cancel_token || '')}&action=cancel`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 12px">${escapeHtml(row.title)} is tomorrow</h2>
        <p style="color:#444;line-height:1.55;margin:0 0 12px">Hey ${escapeHtml(row.name || 'there')} — just a heads up your potluck is tomorrow.</p>
        <div style="padding:14px 16px;background:#F5EFE3;border:1px solid #DDD2BB;border-radius:10px;color:#2A2730;font-size:14px;line-height:1.6">
          <div><strong>When:</strong> ${escapeHtml(row.date_label || row.event_date || '')} ${escapeHtml(row.time_label || '')}</div>
          <div><strong>Where:</strong> ${escapeHtml(row.location || '')}</div>
        </div>
        <p style="color:#666;font-size:13px;margin:18px 0 0">Can't make it? <a href="${cancelUrl}" style="color:#7C3AED">Cancel your RSVP</a> so someone else can grab the spot.</p>
      </div>`;
    const text = `${row.title} is tomorrow.\n\nWhen: ${row.date_label || row.event_date || ''} ${row.time_label || ''}\nWhere: ${row.location || ''}\n\nCan't make it? Cancel: ${cancelUrl}`;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: fromEmail, to: row.email, subject, text, html }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        errors.push(`rsvp ${row.id}: resend ${res.status} ${t.slice(0, 120)}`);
        continue;
      }
      await db.prepare(`UPDATE potluck_rsvp SET reminder_sent_at = datetime('now') WHERE id = ?`).bind(row.id).run();
      sent++;
    } catch (e: any) {
      errors.push(`rsvp ${row.id}: ${e?.message || 'network error'}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
