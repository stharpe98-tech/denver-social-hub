import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  const { message } = await request.json().catch(() => ({ message: "" }));
  if (!db) return new Response(JSON.stringify({ error: "db" }), { status: 500 });
  try {
    const member: any = await db.prepare("SELECT name FROM members WHERE email=?").bind(user.email).first();
    const expires = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
    await db.prepare("INSERT INTO free_tonight (email, name, message, expires_at) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET message=?, expires_at=?").bind(user.email, member?.name || user.name, message || "", expires, message || "", expires).run();
    return new Response(JSON.stringify({ success: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
