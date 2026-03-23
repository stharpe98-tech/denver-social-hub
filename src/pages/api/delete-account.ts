import { env } from "cloudflare:workers";

const POST = async ({ cookies }) => {
  const db = env.DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user;
  try {
    user = JSON.parse(cookie);
  } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  const email = user.email;
  if (!db || !email) return new Response(JSON.stringify({ error: "missing" }), { status: 400 });
  try {
    const tables = [
      "DELETE FROM members WHERE email=?",
      "DELETE FROM event_rsvps WHERE email=?",
      "DELETE FROM event_ratings WHERE email=?",
      "DELETE FROM member_streaks WHERE email=?",
      "DELETE FROM free_tonight WHERE email=?",
      "DELETE FROM checkins WHERE email=?",
      "DELETE FROM gear_claims WHERE email=?",
      "DELETE FROM shoutouts WHERE email=?",
      "DELETE FROM suggestions WHERE email=?"
    ];
    const driverTables = [
      "DELETE FROM carpools WHERE driver_email=?",
      "DELETE FROM referrals WHERE referrer_email=?"
    ];
    for (const sql of tables) {
      try {
        await db.prepare(sql).bind(email).run();
      } catch {
      }
    }
    for (const sql of driverTables) {
      try {
        await db.prepare(sql).bind(email).run();
      } catch {
      }
    }
    return new Response(null, {
      status: 302,
      headers: {
        "Location": "/?deleted=1",
        "Set-Cookie": "dsn_user=; Path=/; Max-Age=0"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
  __proto__: null,
  POST
export {
  page
};