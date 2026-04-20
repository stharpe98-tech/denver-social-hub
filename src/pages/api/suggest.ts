import type { APIContext } from 'astro';
import { getDB } from '../../lib/db';

export const prerender = false;

export async function POST({ request, cookies }: APIContext) {
  const cookie = cookies.get("dsn_user")?.value;
  let user: any = null;
  if (cookie) { try { user = JSON.parse(cookie); } catch {} }

  const db = getDB();
  if (!db) return new Response(JSON.stringify({ error: 'DB unavailable' }), { status: 500 });

  try {
    const { title, description, type } = await request.json() as any;

    if (!title || !title.trim()) {
      return new Response(JSON.stringify({ error: 'Title is required' }), { status: 400 });
    }

    const memberName = user?.name || 'Anonymous';
    const memberId = user?.id || null;
    const eventType = type || 'other';
    const desc = (description || '').trim();

    await db.prepare(
      `INSERT INTO suggestions (title, description, type, votes, member_id, member_name, status) VALUES (?, ?, ?, 0, ?, ?, 'open')`
    ).bind(title.trim(), desc, eventType, memberId, memberName).run();

    return new Response(JSON.stringify({ ok: true }));
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
