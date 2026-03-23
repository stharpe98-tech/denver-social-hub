import { env } from "cloudflare:workers";

import { env } from "cloudflare:workers";
const POST = async ({ url, cookies }) => {
  const db = env.DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  const id = url.searchParams.get("id");
  if (!db || !id) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    await db.prepare("UPDATE suggestions SET votes = votes + 1 WHERE id = ?").bind(id).run();
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