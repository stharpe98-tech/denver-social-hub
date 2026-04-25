import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });

  let user: any;
  try { user = JSON.parse(decodeURIComponent(cookie)); } catch { return new Response(JSON.stringify({ error: "bad cookie" }), { status: 401 }); }

  try {
    const { rec_id } = await request.json();
    if (!rec_id) return new Response(JSON.stringify({ error: "missing rec_id" }), { status: 400 });

    // Check if already voted
    const existing: any = await db.prepare(
      "SELECT id FROM recommendation_votes WHERE rec_id=? AND email=?"
    ).bind(rec_id, user.email).first();

    if (existing) {
      // Un-vote
      await db.prepare("DELETE FROM recommendation_votes WHERE id=?").bind(existing.id).run();
      await db.prepare("UPDATE recommendations SET votes = votes - 1 WHERE id=? AND votes > 0").bind(rec_id).run();
      const rec: any = await db.prepare("SELECT votes FROM recommendations WHERE id=?").bind(rec_id).first();
      return new Response(JSON.stringify({ success: true, voted: false, votes: rec?.votes || 0 }));
    } else {
      // Vote
      await db.prepare(
        "INSERT INTO recommendation_votes (rec_id, email) VALUES (?,?)"
      ).bind(rec_id, user.email).run();
      await db.prepare("UPDATE recommendations SET votes = votes + 1 WHERE id=?").bind(rec_id).run();
      const rec: any = await db.prepare("SELECT votes FROM recommendations WHERE id=?").bind(rec_id).first();
      return new Response(JSON.stringify({ success: true, voted: true, votes: rec?.votes || 0 }));
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
