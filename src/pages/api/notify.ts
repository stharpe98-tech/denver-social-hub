import { env } from "cloudflare:workers";
const POST = async ({ request, cookies }) => {
  const e = env;
  const db = e.DB;
  const resendKey = e.RESEND_API_KEY;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user;
  try {
    user = JSON.parse(cookie);
  } catch {
    return new Response("bad", { status: 401 });
  }
  if (user.email !== "stharpe98@gmail.com") return new Response("admin only", { status: 403 });
  const { type, event_id } = await request.json();
  if (type === "new_event" && event_id && resendKey) {
    try {
      const event = await db.prepare("SELECT * FROM events WHERE id=?").bind(event_id).first();
      if (!event) return new Response(JSON.stringify({ error: "no event" }), { status: 404 });
      const members = await db.prepare("SELECT email, name FROM members WHERE name IS NOT NULL AND name != '' AND (suspended IS NULL OR suspended=0)").all();
      const emails = (members?.results || []).map((m) => m.email).filter(Boolean);
      if (emails.length === 0) return new Response(JSON.stringify({ sent: 0 }));
      const typeEmoji = { dinner: "🍽️", game_night: "🎳", outdoor: "🏔️", brewery: "🍺", camping: "🏕️", group_tickets: "🎫", concert: "🎵" };
      const emoji = typeEmoji[event.event_type] || "📅";
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Denver Social <noreply@denversocial.club>",
          to: emails,
          subject: `${emoji} New event: ${event.title}`,
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:32px;background:#0f1117;color:#e8e6e0;border-radius:16px">
            <h1 style="font-size:22px;margin-bottom:8px">${emoji} ${event.title}</h1>
            <p style="color:#8a8680;margin-bottom:16px">${event.description || ""}</p>
            <p style="margin-bottom:4px">📅 ${event.event_month} ${event.event_day}</p>
            <p style="margin-bottom:4px">📍 ${event.zone}</p>
            <p style="margin-bottom:16px">👥 ${event.spots} spots</p>
            <a href="https://denver-social-hub.stharpe98.workers.dev/events/${event.id}" style="display:inline-block;padding:14px 28px;background:#3b82f6;color:#fff;border-radius:12px;text-decoration:none;font-weight:700">RSVP Now →</a>
          </div>`
        })
      });
      const data = await r.json();
      return new Response(JSON.stringify({ sent: emails.length, data }));
    } catch (e2) {
      return new Response(JSON.stringify({ error: e2.message }), { status: 500 });
    }
  }
  return new Response(JSON.stringify({ error: "unknown type" }), { status: 400 });
};
  __proto__: null,
  POST
export {
  page
};