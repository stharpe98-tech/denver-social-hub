// Single endpoint for all group actions. The frontend POSTs
// { action, ...params } here. Keeps the API surface tiny.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import { ensureGroupsSchema, slugify, inviteCode, isMember, memberRole, refreshMemberCount } from '../../lib/groups-schema';

export const prerender = false;

function unauthed() {
  return new Response(JSON.stringify({ ok: false, error: 'not_signed_in' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
}
function bad(error: string, status = 400) {
  return new Response(JSON.stringify({ ok: false, error }), { status, headers: { 'Content-Type': 'application/json' } });
}
function ok(data: any = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), { headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const cookie = cookies.get('dsn_user')?.value;
  let user: any = null;
  try { if (cookie) user = JSON.parse(cookie); } catch {}
  if (!user?.email) return unauthed();

  const db = getDB();
  if (!db) return bad('db_unavailable', 500);
  await ensureGroupsSchema(db);

  const body = await request.json().catch(() => ({})) as any;
  const action = body?.action as string;

  if (action === 'create') {
    const name = (body.name || '').toString().trim();
    const description = (body.description || '').toString().trim();
    const privacy = body.privacy === 'invite_only' ? 'invite_only' : 'public';
    if (name.length < 3 || name.length > 60) return bad('name_length');

    // Slug uniqueness: append -2, -3, ... if taken
    const base = slugify(name);
    let slug = base;
    let n = 2;
    while (await db.prepare('SELECT 1 FROM groups WHERE slug=?').bind(slug).first()) {
      slug = `${base}-${n++}`;
      if (n > 50) return bad('slug_exhausted');
    }

    const insert = await db.prepare(
      "INSERT INTO groups (slug, name, description, creator_email, privacy, member_count) VALUES (?, ?, ?, ?, ?, 1)"
    ).bind(slug, name, description, user.email, privacy).run();
    const groupId = (insert as any).meta?.last_row_id;

    await db.prepare(
      "INSERT INTO group_members (group_id, member_email, role) VALUES (?, ?, 'owner')"
    ).bind(groupId, user.email).run();

    return ok({ slug, id: groupId });
  }

  if (action === 'join') {
    const groupId = parseInt(body.group_id);
    if (!groupId) return bad('group_id');
    const group: any = await db.prepare('SELECT * FROM groups WHERE id=?').bind(groupId).first();
    if (!group) return bad('not_found', 404);
    if (group.privacy !== 'public') return bad('invite_required', 403);
    if (await isMember(db, groupId, user.email)) return ok({ already: true, slug: group.slug });
    await db.prepare(
      "INSERT OR IGNORE INTO group_members (group_id, member_email, role) VALUES (?, ?, 'member')"
    ).bind(groupId, user.email).run();
    await refreshMemberCount(db, groupId);
    return ok({ slug: group.slug });
  }

  if (action === 'leave') {
    const groupId = parseInt(body.group_id);
    if (!groupId) return bad('group_id');
    const role = await memberRole(db, groupId, user.email);
    if (!role) return bad('not_member');
    if (role === 'owner') {
      const others: any = await db.prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id=? AND member_email != ?').bind(groupId, user.email).first();
      if ((others?.c || 0) > 0) return bad('transfer_ownership_first');
    }
    await db.prepare('DELETE FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)').bind(groupId, user.email).run();
    // If the owner left and the group is empty, also delete the group + invites
    if (role === 'owner') {
      await db.prepare('DELETE FROM group_invites WHERE group_id=?').bind(groupId).run();
      await db.prepare('DELETE FROM groups WHERE id=?').bind(groupId).run();
      return ok({ deleted: true });
    }
    await refreshMemberCount(db, groupId);
    return ok({});
  }

  if (action === 'invite') {
    // Generates an invite code for the given group. Members of the group
    // can invite. invitee_email is optional — if provided, the code is
    // earmarked (but anyone with the link can still use it; this is a
    // soft attribution, not a hard binding).
    const groupId = parseInt(body.group_id);
    if (!groupId) return bad('group_id');
    if (!(await isMember(db, groupId, user.email))) return bad('not_member', 403);
    const invitee = (body.invitee_email || '').toString().trim().toLowerCase() || null;
    const code = inviteCode();
    await db.prepare(
      "INSERT INTO group_invites (group_id, inviter_email, invitee_email, code) VALUES (?, ?, ?, ?)"
    ).bind(groupId, user.email, invitee, code).run();
    return ok({ code });
  }

  if (action === 'accept') {
    const code = (body.code || '').toString().trim();
    if (!code) return bad('code');
    const invite: any = await db.prepare('SELECT * FROM group_invites WHERE code=?').bind(code).first();
    if (!invite) return bad('invalid_code', 404);
    if (invite.used_at) return bad('already_used');
    const group: any = await db.prepare('SELECT * FROM groups WHERE id=?').bind(invite.group_id).first();
    if (!group) return bad('group_gone', 404);

    if (!(await isMember(db, invite.group_id, user.email))) {
      await db.prepare(
        "INSERT OR IGNORE INTO group_members (group_id, member_email, role) VALUES (?, ?, 'member')"
      ).bind(invite.group_id, user.email).run();
      await refreshMemberCount(db, invite.group_id);
    }
    await db.prepare("UPDATE group_invites SET used_at = datetime('now'), used_by_email = ? WHERE id = ?")
      .bind(user.email, invite.id).run();

    return ok({ slug: group.slug });
  }

  return bad('unknown_action');
};
