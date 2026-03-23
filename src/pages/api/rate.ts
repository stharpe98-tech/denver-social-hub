import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  const { event_id, rating } = await request.json();
  if (!db || !event_id || !rating) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    await db.prepare("INSERT INTO event_ratings (event_id, email, rating) VALUES (?,?,?) ON CONFLICT(event_id,email) DO UPDATE SET rating=?").bind(event_id, user.email, rating, rating).run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
