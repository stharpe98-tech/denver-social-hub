import { env } from "cloudflare:workers";

function getDB(): D1Database | null {
  return (env as any).DB || null;
}

// POST: create a comment. Open to everyone — author name comes from
// the form body. Votes are disabled (no stable identity).
export const POST = async ({ request }: { request: Request }) => {
  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  const form = await request.formData();
  const eventId = form.get('event_id')?.toString();
  const body = form.get('body')?.toString()?.trim();
  const parentId = form.get('parent_id')?.toString() || null;
  const authorName = (form.get('author_name')?.toString() || form.get('name')?.toString() || '').trim() || 'Community Member';

  if (!eventId || !body) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  }

  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO comments (id, event_id, user_id, body, parent_id, author_name, author_karma)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, eventId, 'anon', body, parentId, authorName, 0).run();

  return new Response(null, { status: 302, headers: { 'Location': `/events/${eventId}` } });
};

// PUT: voting on comments requires a stable identity. Disabled.
export const PUT = async () => new Response(
  JSON.stringify({ ok: false, error: 'disabled' }),
  { status: 200, headers: { 'Content-Type': 'application/json' } }
);
