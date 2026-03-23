import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const resendKey = (env as any).RESEND_API_KEY;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  if (user.email !== "stharpe98@gmail.com") {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 403 });
  }
  const { event_id } = await request.json();
  if (!db || !event_id) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const event: any = await db.prepare("SELECT * FROM events WHERE id=?").bind(event_id).first();
    if (!event) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    const members: any = await db.prepare("SELECT email, name FROM members WHERE email != ''").all();
    let sent = 0;
    for (const m of members?.results || []) {
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "DSN Denver <noreply@denversocialnights.com>",
            to: m.email,
            subject: `New event: ${event.title}`,
            html: `<p>Hey ${m.name},</p><p>A new event was just posted: <strong>${event.title}</strong> on ${event.event_month} ${event.event_day}.</p><p><a href="https://denver-social-hub.stharpe98.workers.dev/events/${event_id}">RSVP here →</a></p>`
          })
        });
        sent++;
      } catch {}
    }
    return new Response(JSON.stringify({ success: true, sent }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
