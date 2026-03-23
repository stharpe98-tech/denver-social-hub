import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  const { to_email, message, event_id } = await request.json();
  if (!db || !to_email) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    await db.prepare("INSERT INTO shoutouts (from_email, to_email, message, event_id) VALUES (?,?,?,?)").bind(user.email, to_email, message || "", event_id || null).run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
