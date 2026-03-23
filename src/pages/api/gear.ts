import { env } from "cloudflare:workers";

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
  const { event_id, item } = await request.json();
  if (!event_id || !item) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const member = await db.prepare("SELECT name FROM members WHERE email=?").bind(user.email).first();
    await db.prepare("INSERT INTO gear_claims (event_id, email, name, item) VALUES (?,?,?,?)").bind(event_id, user.email, member?.name || user.name, item).run();
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