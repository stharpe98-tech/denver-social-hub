import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login_required" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad_cookie" }), { status: 401 });
  }
  if (!db) return new Response(JSON.stringify({ error: "db_unavailable" }), { status: 500 });

  try {
    // Check if suspended
    const memberCheck: any = await db.prepare("SELECT suspended FROM members WHERE email=?").bind(user.email).first();
    if (memberCheck?.suspended) {
      return new Response(JSON.stringify({ error: "suspended" }), { status: 403 });
    }

    // Get all upcoming events with open spots, excluding ones user already RSVP'd to
    const allEvents: any[] = (await db.prepare(
      `SELECT e.*,
        (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id = e.id) as rsvp_count
       FROM events e
       WHERE (e.is_past IS NULL OR e.is_past = 0)
       ORDER BY e.id DESC`
    ).all())?.results || [];

    // Filter to events with open spots that user hasn't already joined
    const userRsvps: any[] = (await db.prepare(
      "SELECT event_id FROM event_rsvps WHERE member_email = ?"
    ).bind(user.email).all())?.results || [];
    const rsvpedIds = new Set(userRsvps.map((r: any) => r.event_id));

    const available = allEvents.filter((e: any) => {
      if (rsvpedIds.has(e.id)) return false;
      const spots = parseInt(e.spots) || 10;
      const taken = e.rsvp_count || 0;
      return taken < spots;
    });

    if (available.length === 0) {
      return new Response(JSON.stringify({ error: "no_events", message: "No open events right now — check back soon or post your own!" }), { status: 404 });
    }

    // Pick a random event from available ones (more fun than just "next")
    const picked = available[Math.floor(Math.random() * available.length)];

    // Auto-RSVP
    await db.prepare(
      "INSERT INTO event_rsvps (event_id, member_email, member_name) VALUES (?,?,?)"
    ).bind(picked.id, user.email, user.name || "").run();

    // Update streak
    try {
      const today = new Date().toISOString().split("T")[0];
      await db.prepare(
        "INSERT INTO member_streaks (email, current_streak, longest_streak, last_event_date, total_events) VALUES (?,1,1,?,1) ON CONFLICT(email) DO UPDATE SET total_events=total_events+1, last_event_date=?"
      ).bind(user.email, today, today).run();
    } catch {}

    // Try to pair them with a blind intro
    let introMatch = null;
    try {
      // Find someone else who RSVP'd to this event and doesn't have a pair yet
      const otherAttendees: any[] = (await db.prepare(
        `SELECT r.member_email, r.member_name, m.bio, m.neighborhood, m.interests
         FROM event_rsvps r
         LEFT JOIN members m ON r.member_email = m.email
         WHERE r.event_id = ? AND r.member_email != ?
         ORDER BY RANDOM() LIMIT 1`
      ).bind(picked.id, user.email).all())?.results || [];

      if (otherAttendees.length > 0) {
        const match = otherAttendees[0];
        // Check if pairing already exists
        const existingPair = await db.prepare(
          `SELECT id FROM blind_intros
           WHERE event_id = ? AND (
             (member1_email = ? AND member2_email = ?) OR
             (member1_email = ? AND member2_email = ?)
           )`
        ).bind(picked.id, user.email, match.member_email, match.member_email, user.email).first();

        if (!existingPair) {
          // Generate a fun fact from their profile
          const funFacts = generateFunFact(match);
          const userFacts = generateFunFact({ bio: '', neighborhood: '', interests: '' });

          await db.prepare(
            `INSERT INTO blind_intros (event_id, member1_email, member1_name, member1_fact, member2_email, member2_name, member2_fact)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            picked.id,
            user.email, user.name || 'Someone', userFacts,
            match.member_email, match.member_name || 'Someone', funFacts
          ).run();

          introMatch = {
            name: (match.member_name || 'Someone').split(' ')[0],
            fact: funFacts
          };
        }
      }
    } catch {}

    return new Response(JSON.stringify({
      ok: true,
      event: {
        id: picked.id,
        title: picked.title,
        type: picked.event_type,
        month: picked.event_month,
        day: picked.event_day,
        zone: picked.zone || picked.location || 'Denver'
      },
      introMatch
    }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

function generateFunFact(member: any): string {
  const facts: string[] = [];
  if (member.neighborhood) facts.push(`Lives near ${member.neighborhood}`);
  if (member.interests) {
    const interests = member.interests.split(',').map((s: string) => s.replace(/^[^\w\s]+\s*/, '').trim()).filter(Boolean);
    if (interests.length > 0) {
      const pick = interests[Math.floor(Math.random() * interests.length)];
      facts.push(`Into ${pick.toLowerCase()}`);
    }
  }
  if (member.bio && member.bio.length > 5) {
    facts.push(member.bio.length > 60 ? member.bio.slice(0, 60) + '...' : member.bio);
  }
  // Fallback generic facts
  const fallbacks = [
    "Also new to the group",
    "Looking to meet new people",
    "First time at this kind of event",
    "Heard about this through a friend"
  ];
  if (facts.length === 0) facts.push(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  return facts[0];
}
