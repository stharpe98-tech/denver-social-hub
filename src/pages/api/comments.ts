import { env } from "cloudflare:workers";

function getDB(): D1Database | null {
  return (env as any).DB || null;
}

function getUser(request: Request, cookies: any): any {
  const c = cookies.get("dsn_user")?.value;
  if (!c) return null;
  try { return JSON.parse(c); } catch { return null; }
}

// POST: create a comment
export const POST = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const user = getUser(request, cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Not logged in' }), { status: 401 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  const form = await request.formData();
  const eventId = form.get('event_id')?.toString();
  const body = form.get('body')?.toString()?.trim();
  const parentId = form.get('parent_id')?.toString() || null;

  if (!eventId || !body) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  // Generate a simple ID
  const id = crypto.randomUUID();

  await db.prepare(
    `INSERT INTO comments (id, event_id, user_id, body, parent_id, author_name, author_karma)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    eventId,
    String(user.id),
    body,
    parentId,
    user.reddit_username || user.name || 'anon',
    user.karma || 0
  ).run();

  // Redirect back to event page
  return new Response(null, {
    status: 302,
    headers: { 'Location': `/events/${eventId}` }
  });
};

// PUT: vote on a comment
export const PUT = async ({ request, cookies }: { request: Request; cookies: any }) => {
  const user = getUser(request, cookies);
  if (!user) return new Response(JSON.stringify({ error: 'Not logged in' }), { status: 401 });

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  const data = await request.json();
  const { comment_id, direction } = data;

  if (!comment_id || !direction) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  const vote = direction === 'up' ? 1 : -1;

  // Upsert vote
  await db.prepare(
    `INSERT INTO comment_votes (comment_id, user_id, vote) VALUES (?, ?, ?)
     ON CONFLICT(comment_id, user_id) DO UPDATE SET vote = excluded.vote`
  ).bind(comment_id, String(user.id), vote).run();

  // Recalculate totals
  const ups: any = await db.prepare(
    "SELECT COUNT(*) as c FROM comment_votes WHERE comment_id = ? AND vote = 1"
  ).bind(comment_id).first();
  const downs: any = await db.prepare(
    "SELECT COUNT(*) as c FROM comment_votes WHERE comment_id = ? AND vote = -1"
  ).bind(comment_id).first();

  await db.prepare(
    "UPDATE comments SET upvotes = ?, downvotes = ? WHERE id = ?"
  ).bind(ups?.c || 0, downs?.c || 0, comment_id).run();

  return new Response(JSON.stringify({ ok: true, score: (ups?.c || 0) - (downs?.c || 0) }));
};
