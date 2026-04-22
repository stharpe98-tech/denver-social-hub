import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login_required" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad_cookie" }), { status: 401 });
  }
  const { event_id } = await request.json();
  if (!db || !event_id) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const memberCheck: any = await db.prepare("SELECT suspended FROM members WHERE email=?").bind(user.email).first();
    if (memberCheck?.suspended) {
      return new Response(JSON.stringify({ error: "suspended", message: "Your account is suspended. Contact Seth to resolve." }), { status: 403 });
    }
    const existing = await db.prepare("SELECT id FROM event_rsvps WHERE event_id=? AND member_email=?").bind(event_id, user.email).first();
    if (existing) {
      await db.prepare("DELETE FROM event_rsvps WHERE event_id=? AND member_email=?").bind(event_id, user.email).run();
      const count: any = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=?").bind(event_id).first();
      return new Response(JSON.stringify({ rsvped: false, count: count?.c || 0 }));
    } else {
      await db.prepare("INSERT INTO event_rsvps (event_id, member_email, member_name) VALUES (?,?,?)").bind(event_id, user.email, user.name || "").run();
      try {
        const today = new Date().toISOString().split("T")[0];
        await db.prepare("INSERT INTO member_streaks (email, current_streak, longest_streak, last_event_date, total_events) VALUES (?,1,1,?,1) ON CONFLICT(email) DO UPDATE SET total_events=total_events+1, last_event_date=?").bind(user.email, today, today).run();
      } catch {}

      // Blind intro — try to pair with another attendee
      let introMatch = null;
      try {
        // Check if user already has a pair for this event
        const existingPair = await db.prepare(
          `SELECT id FROM blind_intros WHERE event_id = ? AND (member1_email = ? OR member2_email = ?)`
        ).bind(event_id, user.email, user.email).first();

        if (!existingPair) {
          // Find an unpaired attendee
          const unpaired: any = await db.prepare(
            `SELECT r.member_email, r.member_name, m.bio, m.neighborhood, m.interests
             FROM event_rsvps r
             LEFT JOIN members m ON r.member_email = m.email
             WHERE r.event_id = ? AND r.member_email != ?
               AND r.member_email NOT IN (
                 SELECT member1_email FROM blind_intros WHERE event_id = ?
                 UNION SELECT member2_email FROM blind_intros WHERE event_id = ?
               )
             ORDER BY RANDOM() LIMIT 1`
          ).bind(event_id, user.email, event_id, event_id).first();

          if (unpaired) {
            const theirFact = pickFact(unpaired);
            const me: any = await db.prepare("SELECT bio, neighborhood, interests FROM members WHERE email=?").bind(user.email).first();
            const myFact = pickFact(me || {});

            await db.prepare(
              `INSERT INTO blind_intros (event_id, member1_email, member1_name, member1_fact, member2_email, member2_name, member2_fact)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(event_id, user.email, user.name || 'Someone', myFact, unpaired.member_email, unpaired.member_name || 'Someone', theirFact).run();

            introMatch = { name: (unpaired.member_name || 'Someone').split(' ')[0], fact: theirFact };
          }
        }
      } catch {}

      const count: any = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=?").bind(event_id).first();
      return new Response(JSON.stringify({ rsvped: true, count: count?.c || 0, introMatch }));
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

function pickFact(member: any): string {
  const facts: string[] = [];
  if (member?.neighborhood) facts.push(`Lives near ${member.neighborhood}`);
  if (member?.interests) {
    const list = member.interests.split(',').map((s: string) => s.replace(/^[^\w\s]+\s*/, '').trim()).filter(Boolean);
    if (list.length > 0) facts.push(`Into ${list[Math.floor(Math.random() * list.length)].toLowerCase()}`);
  }
  if (member?.bio && member.bio.length > 5) facts.push(member.bio.length > 60 ? member.bio.slice(0, 60) + '...' : member.bio);
  const fallbacks = ["Also new to the group", "Looking to meet new people", "First time at this kind of event", "Heard about this through a friend"];
  return facts.length > 0 ? facts[0] : fallbacks[Math.floor(Math.random() * fallbacks.length)];
}
