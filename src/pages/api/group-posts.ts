// Group posts API — re-enabled. Posting requires a profile session AND
// membership in the group. Anyone can read posts in public groups; private
// groups gate reads behind membership.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureGroupsSchema, memberRole } from '../../lib/groups-schema';
import { ensureGroupPostsSchema } from '../../lib/group-posts-schema';
import { getCurrentProfile } from '../../lib/profile-auth';

export const prerender = false;

const j = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function refreshCommentCount(db: D1Database, postId: number) {
  const row: any = await db.prepare('SELECT COUNT(*) as c FROM group_post_comments WHERE post_id=?').bind(postId).first();
  await db.prepare('UPDATE group_posts SET comment_count=? WHERE id=?').bind(row?.c || 0, postId).run();
}
async function refreshReactionCount(db: D1Database, postId: number) {
  const row: any = await db.prepare('SELECT COUNT(*) as c FROM group_post_reactions WHERE post_id=?').bind(postId).first();
  await db.prepare('UPDATE group_posts SET reaction_count=? WHERE id=?').bind(row?.c || 0, postId).run();
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return j(500, { ok: false, error: 'db_unavailable' });
  await ensureGroupsSchema(db);
  await ensureGroupPostsSchema(db);

  let body: any = {};
  try { body = await request.json(); } catch { return j(400, { ok: false, error: 'bad_json' }); }
  const action = String(body.action || '');

  const me = await getCurrentProfile(cookies, db, request);

  // Listing is the one read-style action — still allow anonymous for public groups.
  if (action === 'list') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    const grp: any = await db.prepare('SELECT id, privacy FROM groups WHERE id=?').bind(groupId).first();
    if (!grp) return j(404, { ok: false, error: 'not_found' });
    if (grp.privacy !== 'public') {
      if (!me || !(await memberRole(db, groupId, me.email))) {
        return j(403, { ok: false, error: 'members_only' });
      }
    }
    const before = parseInt(String(body.before || '0'), 10);
    const rows = before > 0
      ? await db.prepare('SELECT * FROM group_posts WHERE group_id=? AND id < ? ORDER BY id DESC LIMIT 20').bind(groupId, before).all()
      : await db.prepare('SELECT * FROM group_posts WHERE group_id=? ORDER BY pinned DESC, id DESC LIMIT 20').bind(groupId).all();
    return j(200, { ok: true, posts: rows.results || [] });
  }

  if (!me) return j(401, { ok: false, error: 'auth_required' });

  // ── CREATE POST ──
  if (action === 'create' || action === 'create_post') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    const text = String(body.body || '').trim();
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    if (!text) return j(400, { ok: false, error: 'empty_body' });
    if (text.length > 2000) return j(400, { ok: false, error: 'too_long' });
    const role = await memberRole(db, groupId, me.email);
    if (!role) return j(403, { ok: false, error: 'not_member' });
    const res: any = await db.prepare(
      `INSERT INTO group_posts (group_id, author_email, author_name, body) VALUES (?, ?, ?, ?)`
    ).bind(groupId, me.email, me.display_name, text).run();
    return j(200, { ok: true, id: res?.meta?.last_row_id });
  }

  // ── DELETE POST ──
  if (action === 'delete' || action === 'delete_post') {
    const postId = parseInt(String(body.post_id || '0'), 10);
    if (!postId) return j(400, { ok: false, error: 'missing_post' });
    const post: any = await db.prepare('SELECT id, group_id, author_email FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return j(404, { ok: false, error: 'not_found' });
    const role = await memberRole(db, post.group_id, me.email);
    const isAuthor = (post.author_email || '').toLowerCase() === me.email.toLowerCase();
    if (!isAuthor && role !== 'owner') return j(403, { ok: false, error: 'forbidden' });
    await db.prepare('DELETE FROM group_post_comments WHERE post_id=?').bind(postId).run();
    await db.prepare('DELETE FROM group_post_reactions WHERE post_id=?').bind(postId).run();
    await db.prepare('DELETE FROM group_posts WHERE id=?').bind(postId).run();
    return j(200, { ok: true });
  }

  // ── REACT (toggle) ──
  if (action === 'react') {
    const postId = parseInt(String(body.post_id || '0'), 10);
    if (!postId) return j(400, { ok: false, error: 'missing_post' });
    const post: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return j(404, { ok: false, error: 'not_found' });
    const role = await memberRole(db, post.group_id, me.email);
    if (!role) return j(403, { ok: false, error: 'not_member' });
    const existing: any = await db.prepare('SELECT 1 FROM group_post_reactions WHERE post_id=? AND LOWER(member_email)=LOWER(?)').bind(postId, me.email).first();
    let reacted: boolean;
    if (existing) {
      await db.prepare('DELETE FROM group_post_reactions WHERE post_id=? AND LOWER(member_email)=LOWER(?)').bind(postId, me.email).run();
      reacted = false;
    } else {
      await db.prepare('INSERT INTO group_post_reactions (post_id, member_email) VALUES (?, ?)').bind(postId, me.email).run();
      reacted = true;
    }
    await refreshReactionCount(db, postId);
    const row: any = await db.prepare('SELECT reaction_count FROM group_posts WHERE id=?').bind(postId).first();
    return j(200, { ok: true, reacted, count: row?.reaction_count || 0 });
  }

  // ── CREATE COMMENT ──
  if (action === 'create_comment') {
    const postId = parseInt(String(body.post_id || '0'), 10);
    const text = String(body.body || '').trim();
    if (!postId) return j(400, { ok: false, error: 'missing_post' });
    if (!text) return j(400, { ok: false, error: 'empty_body' });
    if (text.length > 600) return j(400, { ok: false, error: 'too_long' });
    const post: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return j(404, { ok: false, error: 'not_found' });
    const role = await memberRole(db, post.group_id, me.email);
    if (!role) return j(403, { ok: false, error: 'not_member' });
    await db.prepare(
      `INSERT INTO group_post_comments (post_id, author_email, author_name, body) VALUES (?, ?, ?, ?)`
    ).bind(postId, me.email, me.display_name, text).run();
    await refreshCommentCount(db, postId);
    return j(200, { ok: true });
  }

  // ── DELETE COMMENT ──
  if (action === 'delete_comment') {
    const commentId = parseInt(String(body.comment_id || '0'), 10);
    if (!commentId) return j(400, { ok: false, error: 'missing_comment' });
    const c: any = await db.prepare('SELECT id, post_id, author_email FROM group_post_comments WHERE id=?').bind(commentId).first();
    if (!c) return j(404, { ok: false, error: 'not_found' });
    const p: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(c.post_id).first();
    const role = p ? await memberRole(db, p.group_id, me.email) : null;
    const isAuthor = (c.author_email || '').toLowerCase() === me.email.toLowerCase();
    if (!isAuthor && role !== 'owner') return j(403, { ok: false, error: 'forbidden' });
    await db.prepare('DELETE FROM group_post_comments WHERE id=?').bind(commentId).run();
    await refreshCommentCount(db, c.post_id);
    return j(200, { ok: true });
  }

  // ── PIN / UNPIN ──
  if (action === 'pin' || action === 'unpin') {
    const postId = parseInt(String(body.post_id || '0'), 10);
    if (!postId) return j(400, { ok: false, error: 'missing_post' });
    const post: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return j(404, { ok: false, error: 'not_found' });
    const role = await memberRole(db, post.group_id, me.email);
    if (role !== 'owner') return j(403, { ok: false, error: 'owner_only' });
    await db.prepare('UPDATE group_posts SET pinned=? WHERE id=?').bind(action === 'pin' ? 1 : 0, postId).run();
    return j(200, { ok: true });
  }

  return j(400, { ok: false, error: 'unknown_action' });
};
