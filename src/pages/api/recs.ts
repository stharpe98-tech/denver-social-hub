import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });

  let user: any;
  try { user = JSON.parse(decodeURIComponent(cookie)); } catch { return new Response(JSON.stringify({ error: "bad cookie" }), { status: 401 }); }

  try {
    const form = await request.json();
    const name = (form.name || "").trim();
    const category = (form.category || "restaurant").trim();
    const cuisine = (form.cuisine || "").trim();
    const neighborhood = (form.neighborhood || "").trim();
    const note = (form.note || "").trim();

    if (!name) return new Response(JSON.stringify({ error: "Name is required" }), { status: 400 });
    if (name.length > 100) return new Response(JSON.stringify({ error: "Name too long" }), { status: 400 });

    await db.prepare(
      "INSERT INTO recommendations (name, category, cuisine, neighborhood, note, submitted_by_email, submitted_by_name) VALUES (?,?,?,?,?,?,?)"
    ).bind(name, category, cuisine, neighborhood, note, user.email, user.name).run();

    return new Response(JSON.stringify({ success: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
