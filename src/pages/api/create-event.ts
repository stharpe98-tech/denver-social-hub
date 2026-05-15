import type { APIContext } from 'astro';
import { env } from 'cloudflare:workers';
import { getDB } from '../../lib/db';
import { mirrorEventCreate } from '../../lib/event-sync/outbound';
import { ensureEventsSchema } from '../../lib/events-schema';

async function notifyAdmin(db: D1Database, eventTitle: string, submittedBy: string) {
  try {
    const cfgRows = await db.prepare("SELECT key, value FROM config").all();
    const cfg: Record<string, string> = {};
    (cfgRows.results ?? []).forEach((r: any) => { cfg[r.key] = r.value; });
    if (!cfg.resend_api_key) return;

    const fromEmail = cfg.from_email || 'Denver Social Hub <hello@denversocialhub.com>';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.resend_api_key}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: ['stharpe98@gmail.com'],
        subject: `New event posted: ${eventTitle}`,
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;">
            <h2 style="font-size:20px;font-weight:800;margin-bottom:8px;color:#1a1a1a">New Event on Denver Social Hub</h2>
            <p style="color:#666;font-size:15px;margin-bottom:24px;">A new event was just posted:</p>
            <div style="background:#f8f6f4;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 8px;">${eventTitle}</p>
              <p style="font-size:14px;color:#666;margin:0;">Posted by: ${submittedBy}</p>
            </div>
            <a href="https://denversocialhub.com/events" style="display:inline-block;background:#7C3AED;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">View Events</a>
          </div>
        `,
      }),
    });
  } catch {
    // Non-blocking — don't fail the event creation if notification fails
  }
}

export const prerender = false;

export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }

  if (!user) {
    return new Response(JSON.stringify({ error: 'You must be logged in to create an event.' }), { status: 401 });
  }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    await ensureEventsSchema(db);
    const { title, description, type, subcat, suggested_date, location, budget, group_size, venue, link, contact_phone, spots: rawSpots, event_month, event_day, vibe_tags, group_id: rawGroupId } = await request.json() as any;

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
    }

    const eventType = type || 'other';
    const desc = (description || '').trim();
    const loc = (location || '').trim();
    const venueName = (venue || '').trim();
    const eventLink = (link || '').trim();
    // Use venue as location if provided, otherwise use area
    const finalLocation = venueName || loc || '';
    const zone = loc || 'TBD';
    const submittedBy = user.name || 'Community Member';

    // Map budget string to price_cap
    const budgetMap: Record<string, string> = {
      'Free': 'Free',
      '$1–10': '$1–10',
      '$10–25': '$10–25',
      '$25–50': '$25–50',
      '$50+': '$50+',
    };
    const priceCap = budgetMap[budget] || 'Free';

    // Map group size to spots (or use raw spots number if provided)
    const sizeMap: Record<string, number> = {
      'Small (4–6)': 6,
      'Medium (8–12)': 12,
      'Large (15+)': 20,
      'Any size': 15,
    };
    const spots = rawSpots ? parseInt(rawSpots) || null : (sizeMap[group_size] || null); // null = unlimited spots

    // Parse month/day — use direct fields if provided, else fall back to suggested_date
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const now = new Date();
    const eventMonth = (event_month || '').trim().toUpperCase() || monthNames[now.getMonth()] || 'TBD';
    const eventDay = (event_day || '').trim();

    // Build description with venue and link if provided
    let fullDesc = desc;
    if (venueName && !fullDesc.includes(venueName)) {
      fullDesc = fullDesc ? venueName + ' — ' + fullDesc : venueName;
    }

    const phone = (contact_phone || '').trim();

    const vibeTagsStr = Array.isArray(vibe_tags)
      ? vibe_tags.filter((s: any) => typeof s === 'string').slice(0, 6).join(',')
      : '';

    // Group scoping (optional). Must be a member of the group to post under it.
    let groupId: number | null = null;
    if (rawGroupId) {
      const gid = parseInt(rawGroupId);
      if (gid) {
        const isMember: any = await db.prepare(
          'SELECT 1 FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)'
        ).bind(gid, user.email).first();
        if (isMember) groupId = gid;
      }
    }

    const insert = await db.prepare(
      `INSERT INTO events (title, description, event_type, location, zone, event_month, event_day, spots, price_cap, submitted_by, discord_link, contact_phone, vibe_tags, group_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      title.trim(),
      fullDesc,
      eventType,
      finalLocation,
      zone,
      eventMonth,
      eventDay || suggested_date || 'TBD',
      spots,
      priceCap,
      submittedBy,
      eventLink,
      phone,
      vibeTagsStr,
      groupId,
    ).run();

    // Notify Seth about new event (non-blocking)
    notifyAdmin(db, title.trim(), submittedBy);

    // Mirror to Discord scheduled events if any source has it enabled (non-blocking).
    const newId = Number((insert as any).meta?.last_row_id) || 0;
    if (newId) {
      const botToken = (env as any).DISCORD_BOT_TOKEN as string | undefined;
      try { await mirrorEventCreate(db, newId, botToken); } catch {}
    }

    return new Response(JSON.stringify({ ok: true, created: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
