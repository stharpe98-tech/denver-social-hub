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
  const { event_id, rating, comment } = await request.json();
  if (!db || !event_id || !rating) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    await db.prepare("INSERT INTO event_ratings (event_id, email, rating, comment) VALUES (?, ?, ?, ?) ON CONFLICT(event_id, email) DO UPDATE SET rating=excluded.rating, comment=excluded.comment").bind(event_id, user.email, rating, comment || "").run();
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