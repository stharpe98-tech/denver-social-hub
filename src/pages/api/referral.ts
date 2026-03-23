import { env } from "cloudflare:workers";

const GET = async ({ cookies }) => {
  const db = env.DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });
  let user;
  try {
    user = JSON.parse(cookie);
  } catch {
    return new Response(JSON.stringify({ error: "bad" }), { status: 401 });
  }
  try {
    let ref = await db.prepare("SELECT code FROM referrals WHERE referrer_email=? AND referred_email IS NULL LIMIT 1").bind(user.email).first();
    if (!ref) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      await db.prepare("INSERT INTO referrals (referrer_email, code) VALUES (?, ?)").bind(user.email, code).run();
      ref = { code };
    }
    const count = await db.prepare("SELECT COUNT(*) as c FROM referrals WHERE referrer_email=? AND status='completed'").bind(user.email).first();
    return new Response(JSON.stringify({ code: ref.code, referrals: count?.c || 0 }));
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
  __proto__: null,
  GET
export {
  page
};