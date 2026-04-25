import { env } from "cloudflare:workers";

function getDB(): D1Database | null {
  return (env as any).DB || null;
}

function getUser(cookies: any): any {
  const c = cookies.get("dsn_user")?.value;
  if (!c) return null;
  try { return JSON.parse(c); } catch { return null; }
}

export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const user = getUser(cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Not logged in' }), { status: 401 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  const form = await request.formData();
  const itemId = form.get('item_id')?.toString();
  const eventId = form.get('event_id')?.toString();

  if (!itemId || !eventId) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  // Check if item is already claimed
  const item: any = await db.prepare("SELECT * FROM bring_items WHERE id = ?").bind(itemId).first();
  if (!item) {
    return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
  }
  if (item.claimed_by_user_id) {
    return new Response(JSON.stringify({ error: 'Already claimed' }), { status: 409 });
  }

  // Claim it
  await db.prepare(
    "UPDATE bring_items SET claimed_by_user_id = ?, claimed_by_name = ?, claimed_at = datetime('now') WHERE id = ? AND claimed_by_user_id IS NULL"
  ).bind(user.id, user.reddit_username || user.name || 'someone', itemId).run();

  return new Response(null, {
    status: 302,
    headers: { 'Location': `/events/${eventId}` }
  });
};
