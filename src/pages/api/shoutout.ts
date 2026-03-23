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
  const { text, event_type } = await request.json();
  if (!text) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const member = await db.prepare("SELECT name FROM members WHERE email=?").bind(user.email).first();
    await db.prepare("INSERT INTO shoutouts (email, name, text, event_type) VALUES (?, ?, ?, ?)").bind(user.email, member?.name || user.name, text, event_type || "").run();
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