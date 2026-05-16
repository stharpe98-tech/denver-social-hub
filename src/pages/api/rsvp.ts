import { env } from "cloudflare:workers";
import { ensureEventRsvpsSchema, generateCheckinToken } from "../../lib/event-rsvps-schema";

// Open RSVP: anyone can RSVP to any event. Identity comes from the
// submitted display_name + (optional) contact_email — dedupe on that
// pair when present. With accounts offline we can't enforce a real
// "one RSVP per person" rule, but we still gate by (event_id,email)
// when an email is given.
export const POST = async ({ request }: { request: Request }) => {
  const db = (env as any).DB;

  let event_id: string | null = null;
  let action: string = 'rsvp';
  let party_size: number = 1;
  let status: string = 'going';
  let bringing: string = '';
  let display_name: string = '';
  let contact_email: string = '';
  let claim_item_ids: string[] = [];
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await request.json() as any;
    event_id = body.event_id;
    action = body.action || 'rsvp';
    party_size = parseInt(body.party_size) || 1;
    status = body.status || 'going';
    bringing = (body.bringing || '').trim();
    display_name = (body.display_name || body.name || '').trim();
    contact_email = (body.contact_email || body.email || '').trim().toLowerCase();
    claim_item_ids = Array.isArray(body.claim_item_ids) ? body.claim_item_ids : [];
  } else {
    const form = await request.formData();
    event_id = form.get('event_id')?.toString() || null;
    action = form.get('action')?.toString() || 'rsvp';
    party_size = parseInt(form.get('party_size')?.toString() || '1') || 1;
    status = form.get('status')?.toString() || 'going';
    bringing = (form.get('bringing')?.toString() || '').trim();
    display_name = (form.get('display_name')?.toString() || form.get('name')?.toString() || '').trim();
    contact_email = (form.get('contact_email')?.toString() || form.get('email')?.toString() || '').trim().toLowerCase();
    claim_item_ids = form.getAll('claim_items').map((v: any) => v.toString());
  }

  if (!db || !event_id) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  if (!display_name) display_name = 'Community Member';

  try {
    const event: any = await db.prepare("SELECT * FROM events WHERE id=?").bind(event_id).first();
    if (!event) return new Response(JSON.stringify({ error: "event_not_found" }), { status: 404 });

    // Dedupe key: prefer email when given; otherwise the display name is
    // all we have to go on. A blank email + repeated names still result
    // in a new row each time, which is the best we can do without auth.
    const dedupeEmail = contact_email || `anon:${display_name.toLowerCase()}`;

    const existing: any = await db.prepare(
      "SELECT id, waitlist_position FROM event_rsvps WHERE event_id=? AND member_email=?"
    ).bind(event_id, dedupeEmail).first();

    if (existing && action === 'update') {
      await db.prepare(
        "UPDATE event_rsvps SET party_size=?, status=?, bringing=? WHERE event_id=? AND member_email=?"
      ).bind(party_size, status, bringing, event_id, dedupeEmail).run();
      return new Response(JSON.stringify({ updated: true }));
    }

    if (existing) {
      const wasWaitlisted = existing.waitlist_position !== null;
      await db.prepare("DELETE FROM event_rsvps WHERE event_id=? AND member_email=?").bind(event_id, dedupeEmail).run();

      if (!wasWaitlisted) {
        const nextWaitlist: any = await db.prepare(
          "SELECT * FROM event_rsvps WHERE event_id=? AND waitlist_position IS NOT NULL ORDER BY waitlist_position ASC LIMIT 1"
        ).bind(event_id).first();
        if (nextWaitlist) {
          await db.prepare("UPDATE event_rsvps SET waitlist_position = NULL WHERE id = ?").bind(nextWaitlist.id).run();
        }
      }

      const count: any = await db.prepare(
        "SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=? AND waitlist_position IS NULL AND (status IS NULL OR status = 'going')"
      ).bind(event_id).first();

      if (contentType.includes('application/json')) {
        return new Response(JSON.stringify({ rsvped: false, count: count?.c || 0 }));
      }
      return new Response(null, { status: 302, headers: { 'Location': `/events/${event_id}` } });
    }

    const confirmedCount: any = await db.prepare(
      "SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=? AND waitlist_position IS NULL AND (status IS NULL OR status = 'going')"
    ).bind(event_id).first();
    const spots = event.spots ? parseInt(event.spots) : null;
    const isFull = spots !== null && (confirmedCount?.c || 0) >= spots;

    if (action === 'waitlist' || isFull) {
      const maxPos: any = await db.prepare(
        "SELECT MAX(waitlist_position) as m FROM event_rsvps WHERE event_id=? AND waitlist_position IS NOT NULL"
      ).bind(event_id).first();
      const nextPos = (maxPos?.m || 0) + 1;
      await db.prepare(
        "INSERT INTO event_rsvps (event_id, member_email, member_name, waitlist_position) VALUES (?,?,?,?)"
      ).bind(event_id, dedupeEmail, display_name, nextPos).run();

      if (contentType.includes('application/json')) {
        return new Response(JSON.stringify({ waitlisted: true, position: nextPos }));
      }
      return new Response(null, { status: 302, headers: { 'Location': `/events/${event_id}` } });
    }

    await ensureEventRsvpsSchema(db);
    const checkinToken = generateCheckinToken();
    await db.prepare(
      "INSERT INTO event_rsvps (event_id, member_email, member_name, party_size, status, bringing, checkin_token) VALUES (?,?,?,?,?,?,?)"
    ).bind(event_id, dedupeEmail, display_name, party_size, status, bringing, checkinToken).run();

    if (claim_item_ids.length > 0) {
      for (const itemId of claim_item_ids) {
        await db.prepare(
          "UPDATE bring_items SET claimed_by_user_id = ?, claimed_by_name = ?, claimed_at = datetime('now') WHERE id = ? AND event_id = ? AND claimed_by_user_id IS NULL"
        ).bind(dedupeEmail, display_name, itemId, event_id).run();
      }
    }

    const newCount: any = await db.prepare(
      "SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=? AND waitlist_position IS NULL AND (status IS NULL OR status = 'going')"
    ).bind(event_id).first();
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
