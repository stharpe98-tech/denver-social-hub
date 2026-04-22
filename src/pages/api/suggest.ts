import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const body = await request.json() as any;
    const { title, description, type, subcat, suggested_date, location, budget, group_size, venue, link, contact_phone } = body;

    // Guest fields (only used if not logged in)
    const guestName = (body.guest_name || '').trim();
    const guestEmail = (body.guest_email || '').trim();

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
    }

    // If not logged in, require name + email
    if (!user && (!guestName || !guestEmail)) {
      return new Response(JSON.stringify({ error: 'Name and email are required' }), { status: 400 });
    }

    // Basic email validation
    if (!user && guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return new Response(JSON.stringify({ error: 'Please enter a valid email' }), { status: 400 });
    }

    let memberId = user?.id || null;
    let memberName = user?.name || guestName || 'Anonymous';
    let memberEmail = user?.email || guestEmail;
    let isNewMember = false;

    // Auto-create member if not logged in
    if (!user && guestEmail && guestName) {
      // Check if this email already exists
      const existing: any = await db.prepare("SELECT id, name, email, role FROM members WHERE email = ?").bind(guestEmail).first();

      if (existing) {
        // They already have an account — use it
        memberId = existing.id;
        memberName = existing.name;
        memberEmail = existing.email;
      } else {
        // Create a new member — welcome to Denver Social
        await db.prepare(
          `INSERT INTO members (email, name, bio, neighborhood, joined_at, interests, points, suggestions_submitted, approved)
           VALUES (?, ?, '', '', datetime('now'), '', 10, 1, 1)`
        ).bind(guestEmail, guestName).run();

        const newMember: any = await db.prepare("SELECT id, name, email, role FROM members WHERE email = ?").bind(guestEmail).first();
        if (newMember) {
          memberId = newMember.id;
          memberName = newMember.name;
          isNewMember = true;
        }
      }

      // Set the login cookie so they're logged in going forward
      cookies.set("dsn_user", JSON.stringify({
        id: memberId,
        email: memberEmail,
        name: memberName,
        role: 'member'
      }), {
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 90 // 90 days
      });
    }

    // Update suggestions_submitted counter
    if (memberId) {
      await db.prepare("UPDATE members SET suggestions_submitted = suggestions_submitted + 1 WHERE id = ?").bind(memberId).run();
    }

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
      `INSERT INTO suggestions (title, description, type, votes, member_id, member_name, status, suggested_date, location, budget, group_size, venue, link, subcat, contact_phone) VALUES (?, ?, ?, 0, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(title.trim(), desc, eventType, memberId, memberName, date, loc, bud, size, ven, lnk, sub, phone).run();

    return new Response(JSON.stringify({
      ok: true,
      isNewMember,
      memberName
    }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
