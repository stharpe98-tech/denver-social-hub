import { env } from "cloudflare:workers";

const POST = async ({ request, cookies }) => {
  const db = env.DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login_required" }), { status: 401 });
  let user;
  try {
    user = JSON.parse(cookie);
  } catch {
    return new Response(JSON.stringify({ error: "bad_cookie" }), { status: 401 });
  }
  const { event_id } = await request.json();
  if (!db || !event_id) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const memberCheck = await db.prepare("SELECT suspended, no_show_count FROM members WHERE email = ?").bind(user.email).first();
    if (memberCheck?.suspended) {
      return new Response(JSON.stringify({ error: "suspended", message: "Your account is suspended due to multiple no-shows. Contact Seth to resolve." }), { status: 403 });
    }
    const existing = await db.prepare("SELECT id FROM event_rsvps WHERE event_id=? AND email=?").bind(event_id, user.email).first();
    if (existing) {
      await db.prepare("DELETE FROM event_rsvps WHERE event_id=? AND email=?").bind(event_id, user.email).run();
      const count = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=?").bind(event_id).first();
      return new Response(JSON.stringify({ rsvped: false, count: count?.c || 0 }));
    } else {
      await db.prepare("INSERT INTO event_rsvps (event_id, email, name) VALUES (?, ?, ?)").bind(event_id, user.email, user.name || "").run();
      try {
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        await db.prepare("INSERT INTO member_streaks (email, current_streak, longest_streak, last_event_date, total_events) VALUES (?, 1, 1, ?, 1) ON CONFLICT(email) DO UPDATE SET total_events = total_events + 1, last_event_date = ?").bind(user.email, today, today).run();
      } catch {
      }
      const count = await db.prepare("SELECT COUNT(*) as c FROM event_rsvps WHERE event_id=?").bind(event_id).first();
      return new Response(JSON.stringify({ rsvped: true, count: count?.c || 0 }));
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
  __proto__: null,
  POST
export {
  page
};