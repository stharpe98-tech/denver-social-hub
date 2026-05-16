import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

// Open suggestions: anyone can submit. We no longer create member rows
// or set login cookies — just take a name from the body and store it.
export async function POST({ request }: APIContext) {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const body = await request.json() as any;
    const { title, description, type, subcat, suggested_date, location, budget, group_size, venue, link, contact_phone } = body;

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
    }

    const guestName = (body.guest_name || body.name || '').trim() || 'Community Member';

    const eventType = type || 'other';
    const desc = (description || '').trim();
    const date = (suggested_date || '').trim();
    const loc = (location || '').trim();
    const bud = (budget || '').trim();
    const size = (group_size || '').trim();
    const ven = (venue || '').trim();
    const lnk = (link || '').trim();
    const sub = (subcat || '').trim();
    const phone = (contact_phone || '').trim();

    await db.prepare(
      `INSERT INTO suggestions (title, description, type, votes, member_id, member_name, status, suggested_date, location, budget, group_size, venue, link, subcat, contact_phone)
       VALUES (?, ?, ?, 0, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title.trim(), desc, eventType, null, guestName, date, loc, bud, size, ven, lnk, sub, phone).run();

    return new Response(JSON.stringify({ ok: true, memberName: guestName }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
