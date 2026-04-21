import { env } from "cloudflare:workers";

export const POST = async ({ cookies }: { cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user: any;
  try { user = JSON.parse(cookie); } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  const email = user.email;
  if (!db || !email) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const tables = [
      "DELETE FROM members WHERE email=?",
      "DELETE FROM event_rsvps WHERE member_email=?",
      "DELETE FROM event_ratings WHERE email=?",
      "DELETE FROM member_streaks WHERE email=?",
      "DELETE FROM free_tonight WHERE email=?",
      "DELETE FROM suggestions WHERE email=?",
    ];
    for (const sql of tables) {
      try { await db.prepare(sql).bind(email).run(); } catch {}
    }
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/",
        "Set-Cookie": "dsn_user=; Path=/; Max-Age=0; SameSite=Lax"
      }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
