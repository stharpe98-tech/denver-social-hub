import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login_required" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad_cookie" }), { status: 401 });
  }

  // Support both JSON body and form data
  let event_id: string | null = null;
  let action: string = 'rsvp';
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json();
    event_id = body.event_id;
    action = body.action || 'rsvp';
  } else {
    const form = await request.formData();
    event_id = form.get('event_id')?.toString() || null;
    action = form.get('action')?.toString() || 'rsvp';
  }

  if (!db || !event_id) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });

  try {
    // Check suspension
    const member: any = await db.prepare("SELECT * FROM members WHERE email=?").bind(user.email).first();
    if (member?.suspended) {
      return new Response(JSON.stringify({ error: "suspended" }), { status: 403 });
    }

    // Get event for karma gate + spots check
    const event: any = await db.prepare("SELECT * FROM events WHERE id=?").bind(event_id).first();
    if (!event) return new Response(JSON.stringify({ error: "event_not_found" }), { status: 404 });

    // Karma gate check
    const userKarma = member?.karma || 0;
    const userAccountAge = member?.reddit_account_created
      ? Math.floor((Date.now() - new Date(member.reddit_account_created).getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    if (event.karma_min && userKarma < event.karma_min) {
      return new Response(JSON.stringify({ error: "karma_too_low", required: event.karma_min, yours: userKarma }), { status: 403 });
    }
    if (event.account_age_min && userAccountAge < event.account_age_min) {
      return new Response(JSON.stringify({ error: "account_too_new", required: event.account_age_min, yours: userAccountAge }), { status: 403 });
    }

    // Check existing RSVP
    const existing: any = await db.prepare("SELECT id, waitlist_position FROM event_rsvps WHERE event_id=? AND member_email=?").bind(event_id, user.email).first();

    if (existing) {
      // Cancel RSVP
      const wasWaitlisted = existing.waitlist_position !== null;
      await db.prepare("DELETE FROM event_rsvps WHERE event_id=? AND member_email=?").bind(event_id, user.email).run();

      // If they were confirmed (not waitlisted), auto-promote next waitlisted person
      if (!wasWaitlisted) {
        const nextWaitlist: any = await db.prepare(
          "SELECT * FROM event_rsvps WHERE event_id=? AND waitlist_position IS NOT NULL ORDER BY waitlist_position ASC LIMIT 1"
        ).bind(event_id).first();
        if (nextWaitlist) {
          await db.prepare(
            "UPDATE event_rsvps SET waitlist_position = NULL WHERE id = ?"
          ).bind(nextWaitlist.id).run();
        }
      }

      const count: any = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=? AND waitlist_position IS NULL").bind(event_id).first();

      if (contentType.includes('application/json')) {
        return new Response(JSON.stringify({ rsvped: false, count: count?.c || 0 }));
      }
      return new Response(null, { status: 302, headers: { 'Location': `/events/${event_id}` } });
    }

    // New RSVP
    const confirmedCount: any = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=? AND waitlist_position IS NULL").bind(event_id).first();
    const spots = parseInt(event.spots) || 12;
    const isFull = (confirmedCount?.c || 0) >= spots;

    if (action === 'waitlist' || isFull) {
      // Add to waitlist
      const maxPos: any = await db.prepare("SELECT MAX(waitlist_position) as m FROM event_rsvps WHERE event_id=? AND waitlist_position IS NOT NULL").bind(event_id).first();
      const nextPos = (maxPos?.m || 0) + 1;
      await db.prepare(
        "INSERT INTO event_rsvps (event_id, member_email, member_name, waitlist_position) VALUES (?,?,?,?)"
      ).bind(event_id, user.email, user.reddit_username || user.name || '', nextPos).run();

      if (contentType.includes('application/json')) {
        return new Response(JSON.stringify({ waitlisted: true, position: nextPos }));
      }
      return new Response(null, { status: 302, headers: { 'Location': `/events/${event_id}` } });
    }

    // Normal RSVP
    await db.prepare(
      "INSERT INTO event_rsvps (event_id, member_email, member_name) VALUES (?,?,?)"
    ).bind(event_id, user.email, user.reddit_username || user.name || '').run();

    // Update rsvp_count on event
    const newCount: any = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=? AND waitlist_position IS NULL").bind(event_id).first();
    await db.prepare("UPDATE events SET rsvp_count = ? WHERE id = ?").bind(newCount?.c || 0, event_id).run();

    if (contentType.includes('application/json')) {
      return new Response(JSON.stringify({ rsvped: true, count: newCount?.c || 0 }));
    }
    return new Response(null, { status: 302, headers: { 'Location': `/events/${event_id}` } });
  } catch (e: any) {
    console.error('RSVP error:', e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
