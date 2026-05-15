// Group post + comment + reaction actions in one endpoint.
// Member-only for write actions; reads happen via the page SSR.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureGroupPostsSchema } from '../../lib/group-posts-schema';
import { ensureGroupsSchema, memberRole, isMember } from '../../lib/groups-schema';

export const prerender = false;

const SUPER_ADMIN_EMAIL = 'stharpe98@gmail.com';

function ok(d: any = {}) { return new Response(JSON.stringify({ ok: true, ...d }), { headers: { 'Content-Type': 'application/json' } }); }
function bad(error: string, status = 400) { return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } }); }

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) return bad('not_signed_in', 401);

  const db = getDB();
  if (!db) return bad('db', 500);
  await ensureGroupsSchema(db);
  await ensureGroupPostsSchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;
  const isSuperAdmin = (user.email || '').toLowerCase() === SUPER_ADMIN_EMAIL;

  if (action === 'create_post') {
    const groupId = parseInt(body.group_id);
    const text = String(body.body || '').trim();
    if (!groupId) return bad('group_id');
    if (text.length < 1) return bad('empty');
    if (text.length > 1000) return bad('too_long');
    if (!(await isMember(db, groupId, user.email))) return bad('not_member', 403);
    const res: any = await db.prepare(
      "INSERT INTO group_posts (group_id, author_email, author_name, body) VALUES (?, ?, ?, ?)"
    ).bind(groupId, user.email, user.name || user.reddit_username || user.discord_username || user.email.split('@')[0], text).run();
    return ok({ id: res?.meta?.last_row_id || null });
  }

  if (action === 'delete_post') {
    const postId = parseInt(body.post_id);
    if (!postId) return bad('post_id');
    const post: any = await db.prepare('SELECT * FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return bad('not_found', 404);
    const role = await memberRole(db, post.group_id, user.email);
    const isAuthor = (post.author_email || '').toLowerCase() === user.email.toLowerCase();
    const canModerate = isAuthor || role === 'owner' || role === 'organizer' || isSuperAdmin;
    if (!canModerate) return bad('not_authorized', 403);
    await db.prepare('DELETE FROM group_post_comments WHERE post_id=?').bind(postId).run();
    await db.prepare('DELETE FROM group_post_reactions WHERE post_id=?').bind(postId).run();
    await db.prepare('DELETE FROM group_posts WHERE id=?').bind(postId).run();
    return ok({});
  }

  if (action === 'pin' || action === 'unpin') {
    const postId = parseInt(body.post_id);
    if (!postId) return bad('post_id');
    const post: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return bad('not_found', 404);
    const role = await memberRole(db, post.group_id, user.email);
    if (role !== 'owner' && role !== 'organizer' && !isSuperAdmin) return bad('not_authorized', 403);
    await db.prepare('UPDATE group_posts SET pinned=? WHERE id=?').bind(action === 'pin' ? 1 : 0, postId).run();
    return ok({});
  }

  if (action === 'react') {
    const postId = parseInt(body.post_id);
    if (!postId) return bad('post_id');
    const post: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return bad('not_found', 404);
    if (!(await isMember(db, post.group_id, user.email))) return bad('not_member', 403);
    const existing: any = await db.prepare('SELECT 1 FROM group_post_reactions WHERE post_id=? AND LOWER(member_email)=LOWER(?)').bind(postId, user.email).first();
    if (existing) {
      await db.prepare('DELETE FROM group_post_reactions WHERE post_id=? AND LOWER(member_email)=LOWER(?)').bind(postId, user.email).run();
    } else {
      await db.prepare('INSERT INTO group_post_reactions (post_id, member_email) VALUES (?, ?)').bind(postId, user.email).run();
    }
    const count: any = await db.prepare('SELECT COUNT(*) as c FROM group_post_reactions WHERE post_id=?').bind(postId).first();
    await db.prepare('UPDATE group_posts SET reaction_count=? WHERE id=?').bind(count?.c || 0, postId).run();
    return ok({ reacted: !existing, count: count?.c || 0 });
  }

  if (action === 'create_comment') {
    const postId = parseInt(body.post_id);
    const text = String(body.body || '').trim();
    if (!postId) return bad('post_id');
    if (text.length < 1) return bad('empty');
    if (text.length > 600) return bad('too_long');
    const post: any = await db.prepare('SELECT group_id FROM group_posts WHERE id=?').bind(postId).first();
    if (!post) return bad('not_found', 404);
    if (!(await isMember(db, post.group_id, user.email))) return bad('not_member', 403);
    await db.prepare(
      "INSERT INTO group_post_comments (post_id, author_email, author_name, body) VALUES (?, ?, ?, ?)"
    ).bind(postId, user.email, user.name || user.reddit_username || user.discord_username || user.email.split('@')[0], text).run();
    const count: any = await db.prepare('SELECT COUNT(*) as c FROM group_post_comments WHERE post_id=?').bind(postId).first();
    await db.prepare('UPDATE group_posts SET comment_count=? WHERE id=?').bind(count?.c || 0, postId).run();
    return ok({});
  }

  if (action === 'delete_comment') {
    const commentId = parseInt(body.comment_id);
    if (!commentId) return bad('comment_id');
    const comment: any = await db.prepare('SELECT c.*, p.group_id FROM group_post_comments c JOIN group_posts p ON p.id = c.post_id WHERE c.id=?').bind(commentId).first();
    if (!comment) return bad('not_found', 404);
    const role = await memberRole(db, comment.group_id, user.email);
    const isAuthor = (comment.author_email || '').toLowerCase() === user.email.toLowerCase();
    const canModerate = isAuthor || role === 'owner' || role === 'organizer' || isSuperAdmin;
    if (!canModerate) return bad('not_authorized', 403);
    await db.prepare('DELETE FROM group_post_comments WHERE id=?').bind(commentId).run();
    const count: any = await db.prepare('SELECT COUNT(*) as c FROM group_post_comments WHERE post_id=?').bind(comment.post_id).first();
    await db.prepare('UPDATE group_posts SET comment_count=? WHERE id=?').bind(count?.c || 0, comment.post_id).run();
    return ok({});
  }

  return bad('unknown_action');
};
