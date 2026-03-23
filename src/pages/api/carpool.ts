import { env } from "cloudflare:workers";

const POST = async ({ request, cookies }) => {
  const db = env.DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user;
  try {
    user = JSON.parse(cookie);
  } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  const { event_id, leaving_from, seats, departure_time } = await request.json();
  if (!event_id || !leaving_from) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const member = await db.prepare("SELECT name FROM members WHERE email=?").bind(user.email).first();
    await db.prepare("INSERT INTO carpools (event_id, driver_email, driver_name, leaving_from, seats_available, departure_time) VALUES (?,?,?,?,?,?)").bind(event_id, user.email, member?.name || user.name, leaving_from, parseInt(seats) || 3, departure_time || "").run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
  __proto__: null,
  POST
export {
  page
};