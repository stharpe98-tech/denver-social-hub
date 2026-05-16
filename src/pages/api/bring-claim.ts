import { env } from "cloudflare:workers";

function getDB(): D1Database | null {
  return (env as any).DB || null;
}

// Open bring-item claim: anyone can claim. The claimer's name comes
// from the form body.
export const POST = async ({ request }: { request: Request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  const form = await request.formData();
  const itemId = form.get('item_id')?.toString();
  const eventId = form.get('event_id')?.toString();
  const claimerName = (form.get('claimer_name')?.toString() || form.get('name')?.toString() || '').trim() || 'Community Member';

  if (!itemId || !eventId) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  const item: any = await db.prepare("SELECT * FROM bring_items WHERE id = ?").bind(itemId).first();
  if (!item) return new Response(JSON.stringify({ error: 'Item not found' }), { status: 404 });
  if (item.claimed_by_user_id) return new Response(JSON.stringify({ error: 'Already claimed' }), { status: 409 });

  await db.prepare(
    "UPDATE bring_items SET claimed_by_user_id = ?, claimed_by_name = ?, claimed_at = datetime('now') WHERE id = ? AND claimed_by_user_id IS NULL"
  ).bind(`anon:${claimerName.toLowerCase()}`, claimerName, itemId).run();

  return new Response(null, {
    status: 302,
    headers: { 'Location': `/events/${eventId}` }
  });
};
