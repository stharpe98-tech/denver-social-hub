import { env } from "cloudflare:workers";

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });

  let user: any;
  try { user = JSON.parse(decodeURIComponent(cookie)); } catch { return new Response(JSON.stringify({ error: "bad cookie" }), { status: 401 }); }

  if (user.email !== "stharpe98@gmail.com") {
    return new Response(JSON.stringify({ error: "admin only" }), { status: 403 });
  }

  try {
    const data = await request.json();
    const entries = Object.entries(data);

    for (const [key, value] of entries) {
      if (typeof key !== 'string' || typeof value !== 'string') continue;
      if (key.length > 100 || value.length > 2000) continue;
      await db.prepare(
        "INSERT INTO site_content (content_key, content_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(content_key) DO UPDATE SET content_value=excluded.content_value, updated_at=CURRENT_TIMESTAMP"
      ).bind(key, value).run();
    }

    return new Response(JSON.stringify({ success: true, updated: entries.length }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};

export const GET = async ({ cookies }: { cookies: any }) => {
  const db = (env as any).DB;
  const cookie = cookies.get("dsn_user")?.value;
  if (!cookie) return new Response(JSON.stringify({ error: "login" }), { status: 401 });

  let user: any;
  try { user = JSON.parse(decodeURIComponent(cookie)); } catch { return new Response(JSON.stringify({ error: "bad cookie" }), { status: 401 }); }

  if (user.email !== "stharpe98@gmail.com") {
    return new Response(JSON.stringify({ error: "admin only" }), { status: 403 });
  }

  try {
    const rows = (await db.prepare("SELECT content_key, content_value FROM site_content").all())?.results || [];
    const content: Record<string, string> = {};
    for (const row of rows as any[]) {
      content[row.content_key] = row.content_value;
    }
    return new Response(JSON.stringify(content));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
};
