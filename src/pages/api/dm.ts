// DM actions: start a conversation, send a message, poll for new messages,
// list conversations, mark read. Gated to profile-page holders — anyone
// without a valid dsn_profile_<slug> cookie gets a 401.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureDmSchema, getOrCreateConversation } from '../../lib/dm-schema';
import { getCurrentProfile } from '../../lib/profile-auth';

export const prerender = false;

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400, extra: any = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return bad('db', 500);
  await ensureDmSchema(db);

  const currentProfile = await getCurrentProfile(cookies, db, request);
  if (!currentProfile) {
    return bad('profile_required', 401, { message: 'You need a /u/[slug] page to message.' });
  }
  const me = currentProfile.email;

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;

  if (action === 'start') {
    const other = String(body.with || '').trim().toLowerCase();
    if (!other || !other.includes('@')) return bad('bad_email');
    if (other === me) return bad('self');
    // Target must have a live profile too — that's the new identity layer.
    const target: any = await db.prepare(
      `SELECT 1 FROM profiles WHERE LOWER(email)=? AND status='live' LIMIT 1`
    ).bind(other).first();
    if (!target) return bad('not_a_member', 404);
    const id = await getOrCreateConversation(db, me, other);
    return ok({ id });
  }

  if (action === 'send') {
    const conversationId = parseInt(body.conversation_id);
    const text = String(body.body || '').trim();
    if (!conversationId) return bad('conversation_id');
    if (text.length < 1) return bad('empty');
    if (text.length > 2000) return bad('too_long');
    const conv: any = await db.prepare('SELECT * FROM dm_conversations WHERE id=?').bind(conversationId).first();
    if (!conv) return bad('not_found', 404);
    if (conv.member_a_email !== me && conv.member_b_email !== me) return bad('not_authorized', 403);
    const res: any = await db.prepare(
      'INSERT INTO dm_messages (conversation_id, from_email, body) VALUES (?, ?, ?)'
    ).bind(conversationId, me, text).run();
    const now = new Date().toISOString();
    await db.prepare(
      'UPDATE dm_conversations SET last_msg_at=?, last_msg_preview=?, last_msg_from=? WHERE id=?'
    ).bind(now, text.slice(0, 120), me, conversationId).run();
    return ok({ id: res?.meta?.last_row_id, at: now });
  }

  if (action === 'poll') {
    const conversationId = parseInt(body.conversation_id);
    const sinceId = parseInt(body.since_id || '0') || 0;
    if (!conversationId) return bad('conversation_id');
    const conv: any = await db.prepare('SELECT * FROM dm_conversations WHERE id=?').bind(conversationId).first();
    if (!conv) return bad('not_found', 404);
    if (conv.member_a_email !== me && conv.member_b_email !== me) return bad('not_authorized', 403);
    const r = await db.prepare(
      'SELECT id, from_email, body, created_at FROM dm_messages WHERE conversation_id=? AND id > ? ORDER BY id ASC LIMIT 100'
    ).bind(conversationId, sinceId).all();
    return ok({ messages: r?.results || [] });
  }

  if (action === 'list') {
    // Conversations involving me, newest activity first. Join against
    // profiles (the new identity table) for the other side's name.
    const r = await db.prepare(`
      SELECT c.id, c.member_a_email, c.member_b_email, c.last_msg_at, c.last_msg_preview, c.last_msg_from,
             p.display_name AS other_name, p.slug AS other_slug,
             (SELECT COUNT(*) FROM dm_messages mm WHERE mm.conversation_id=c.id AND mm.from_email != ? AND mm.read_at IS NULL) AS unread
      FROM dm_conversations c
      LEFT JOIN profiles p ON LOWER(p.email) = CASE WHEN LOWER(c.member_a_email)=? THEN LOWER(c.member_b_email) ELSE LOWER(c.member_a_email) END
      WHERE LOWER(c.member_a_email)=? OR LOWER(c.member_b_email)=?
      ORDER BY COALESCE(c.last_msg_at, c.created_at) DESC
    `).bind(me, me, me, me).all();
    return ok({ conversations: r?.results || [] });
  }

  if (action === 'mark_read') {
    const conversationId = parseInt(body.conversation_id);
    if (!conversationId) return bad('conversation_id');
    await db.prepare(
      "UPDATE dm_messages SET read_at=datetime('now') WHERE conversation_id=? AND from_email != ? AND read_at IS NULL"
    ).bind(conversationId, me).run();
    return ok({});
  }

  return bad('unknown_action');
};
