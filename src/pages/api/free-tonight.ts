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
  const { message } = await request.json();
  try {
    const member = await db.prepare("SELECT name, neighborhood FROM members WHERE email=?").bind(user.email).first();
    await db.prepare("INSERT INTO free_tonight (email, name, neighborhood, message) VALUES (?, ?, ?, ?)").bind(user.email, member?.name || user.name, member?.neighborhood || "", message || "").run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
const GET = async () => {
  const db = env.DB;
  try {
    const r = await db.prepare("SELECT * FROM free_tonight WHERE expires_at > datetime('now') ORDER BY created_at DESC LIMIT 20").all();
    return new Response(JSON.stringify({ people: r?.results || [] }));
  } catch (e) {
    return new Response(JSON.stringify({ people: [] }));
  }
};
  __proto__: null,
  GET,
  POST
export {
  page
};