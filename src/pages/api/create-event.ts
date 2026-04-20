import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

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
    const { title, description, type, subcat, suggested_date, location, budget, group_size, venue, link } = await request.json() as any;

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

    // Map group size to spots
    const sizeMap: Record<string, number> = {
      'Small (4–6)': 6,
      'Medium (8–12)': 12,
      'Large (15+)': 20,
      'Any size': 15,
    };
    const spots = sizeMap[group_size] || 12;

    // Parse suggested_date into month display
    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const now = new Date();
    const eventMonth = monthNames[now.getMonth()] || 'TBD';

    // Build description with venue and link if provided
    let fullDesc = desc;
    if (venueName && !fullDesc.includes(venueName)) {
      fullDesc = fullDesc ? venueName + ' — ' + fullDesc : venueName;
    }

    await db.prepare(
      `INSERT INTO events (title, description, event_type, location, zone, event_month, event_day, spots, price_cap, submitted_by, discord_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      title.trim(),
      fullDesc,
      eventType,
      finalLocation,
      zone,
      eventMonth,
      suggested_date || 'TBD',
      spots,
      priceCap,
      submittedBy,
      eventLink
    ).run();

    return new Response(JSON.stringify({ ok: true, created: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
