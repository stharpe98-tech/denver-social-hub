// Group write API — re-enabled with tier-aware access:
//   * Regular profiles  : join/leave public groups, redeem invites, post.
//   * Organizer profiles: same + create/update/delete groups, send invites,
//                         kick members.
//   * Anonymous         : all writes 401.
import type { APIRoute } from 'astro';
import { getDB } from '../../lib/db';
import {
  ensureGroupsSchema,
  slugify,
  inviteCode,
  memberRole,
  refreshMemberCount,
} from '../../lib/groups-schema';
import { getCurrentProfile } from '../../lib/profile-auth';

export const prerender = false;

const j = (status: number, body: any) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

async function uniqueSlug(db: D1Database, base: string, ignoreId?: number): Promise<string> {
  let candidate = base || 'group';
  let n = 0;
  while (true) {
    const row: any = await db
      .prepare('SELECT id FROM groups WHERE slug = ?')
      .bind(candidate)
      .first();
    if (!row) return candidate;
    if (ignoreId && row.id === ignoreId) return candidate;
    n += 1;
    candidate = `${base}-${n + 1}`;
    if (n > 80) return `${base}-${Date.now().toString(36).slice(-4)}`;
  }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const db = getDB();
  if (!db) return j(500, { ok: false, error: 'db_unavailable' });
  await ensureGroupsSchema(db);

  let body: any = {};
  try { body = await request.json(); } catch { return j(400, { ok: false, error: 'bad_json' }); }
  const action = String(body.action || '');
  if (!action) return j(400, { ok: false, error: 'missing_action' });

  const me = await getCurrentProfile(cookies, db, request);
  if (!me) return j(401, { ok: false, error: 'auth_required' });

  // ── CREATE ──
  if (action === 'create') {
    if (me.tier !== 'organizer') return j(403, { ok: false, error: 'organizers_only' });
    const name = String(body.name || '').trim().slice(0, 80);
    if (name.length < 3) return j(400, { ok: false, error: 'name_too_short' });
    const description = String(body.description || '').trim().slice(0, 1000);
    const category = String(body.category || 'general').trim().slice(0, 40);
    const neighborhood = String(body.neighborhood || '').trim().slice(0, 60);
    const cover_emoji = String(body.cover_emoji || '👥').trim().slice(0, 8) || '👥';
    const privacy = body.privacy === 'invite_only' ? 'invite_only' : 'public';
    const slug = await uniqueSlug(db, slugify(name));

    const res: any = await db
      .prepare(`INSERT INTO groups (slug, name, description, creator_email, privacy, member_count, category, neighborhood, cover_emoji)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`)
      .bind(slug, name, description, me.email, privacy, category, neighborhood, cover_emoji)
      .run();
    const groupId = res?.meta?.last_row_id;
    if (!groupId) return j(500, { ok: false, error: 'insert_failed' });

    await db.prepare(`INSERT INTO group_members (group_id, member_email, role) VALUES (?, ?, 'owner')`)
      .bind(groupId, me.email).run();
    await refreshMemberCount(db, groupId as number);
    return j(200, { ok: true, slug, id: groupId });
  }

  // ── JOIN ──
  if (action === 'join') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    const grp: any = await db.prepare('SELECT id, privacy FROM groups WHERE id=?').bind(groupId).first();
    if (!grp) return j(404, { ok: false, error: 'not_found' });

    if (grp.privacy !== 'public') {
      const inv: any = await db
        .prepare(`SELECT id FROM group_invites WHERE group_id=? AND used_at IS NULL
                  AND (expires_at IS NULL OR expires_at > datetime('now'))
                  AND (invitee_email IS NULL OR LOWER(invitee_email)=LOWER(?))
                  LIMIT 1`)
        .bind(groupId, me.email).first();
      if (!inv) return j(403, { ok: false, error: 'invite_required' });
    }

    const exists: any = await db
      .prepare('SELECT 1 FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)')
      .bind(groupId, me.email).first();
    if (exists) return j(409, { ok: false, error: 'already_member' });

    await db.prepare(`INSERT INTO group_members (group_id, member_email, role) VALUES (?, ?, 'member')`)
      .bind(groupId, me.email).run();
    await refreshMemberCount(db, groupId);
    return j(200, { ok: true });
  }

  // ── LEAVE ──
  if (action === 'leave') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    const role = await memberRole(db, groupId, me.email);
    if (!role) return j(404, { ok: false, error: 'not_member' });
    if (role === 'owner') return j(400, { ok: false, error: 'transfer_first' });
    await db.prepare('DELETE FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)')
      .bind(groupId, me.email).run();
    await refreshMemberCount(db, groupId);
    return j(200, { ok: true });
  }

  // ── UPDATE ──
  if (action === 'update') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    const role = await memberRole(db, groupId, me.email);
    if (role !== 'owner') return j(403, { ok: false, error: 'owner_only' });
    const grp: any = await db.prepare('SELECT * FROM groups WHERE id=?').bind(groupId).first();
    if (!grp) return j(404, { ok: false, error: 'not_found' });

    const name = String(body.name ?? grp.name).trim().slice(0, 80);
    if (name.length < 3) return j(400, { ok: false, error: 'name_too_short' });
    const description = String(body.description ?? grp.description ?? '').trim().slice(0, 1000);
    const category = String(body.category ?? grp.category ?? 'general').trim().slice(0, 40);
    const neighborhood = String(body.neighborhood ?? grp.neighborhood ?? '').trim().slice(0, 60);
    const cover_emoji = String(body.cover_emoji ?? grp.cover_emoji ?? '👥').trim().slice(0, 8) || '👥';
    const privacy = body.privacy === 'invite_only' ? 'invite_only'
                  : body.privacy === 'public'      ? 'public'
                  : grp.privacy;

    let slug = grp.slug;
    if (name !== grp.name) {
      const desired = slugify(name);
      if (desired !== grp.slug) {
        const taken: any = await db.prepare('SELECT id FROM groups WHERE slug=? AND id!=?').bind(desired, groupId).first();
        if (!taken) slug = desired;
      }
    }
    await db.prepare(`UPDATE groups SET name=?, description=?, category=?, neighborhood=?, cover_emoji=?, privacy=?, slug=? WHERE id=?`)
      .bind(name, description, category, neighborhood, cover_emoji, privacy, slug, groupId).run();
    return j(200, { ok: true, slug });
  }

  // ── INVITE ──
  if (action === 'invite') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    const role = await memberRole(db, groupId, me.email);
    if (role !== 'owner') return j(403, { ok: false, error: 'owner_only' });
    const invitee = String(body.invitee_email || '').trim().toLowerCase().slice(0, 200) || null;
    const code = inviteCode();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    await db.prepare(`INSERT INTO group_invites (group_id, inviter_email, invitee_email, code, expires_at)
                      VALUES (?, ?, ?, ?, ?)`)
      .bind(groupId, me.email, invitee, code, expiresAt).run();
    return j(200, { ok: true, code, url: `/groups/join/${code}` });
  }

  // ── REDEEM (invite code) ──
  if (action === 'redeem') {
    const code = String(body.code || '').trim();
    if (!code) return j(400, { ok: false, error: 'missing_code' });
    const inv: any = await db.prepare(
      `SELECT id, group_id, invitee_email, used_at, expires_at FROM group_invites WHERE code=?`
    ).bind(code).first();
    if (!inv) return j(404, { ok: false, error: 'invalid_code' });
    if (inv.used_at) return j(410, { ok: false, error: 'already_used' });
    if (inv.expires_at) {
      const exp = new Date(inv.expires_at.includes('T') ? inv.expires_at : inv.expires_at + 'Z').getTime();
      if (Number.isFinite(exp) && Date.now() > exp) return j(410, { ok: false, error: 'expired' });
    }
    if (inv.invitee_email && inv.invitee_email.toLowerCase() !== me.email.toLowerCase()) {
      return j(403, { ok: false, error: 'not_for_you' });
    }
    const grp: any = await db.prepare('SELECT id, slug FROM groups WHERE id=?').bind(inv.group_id).first();
    if (!grp) return j(404, { ok: false, error: 'group_gone' });

    const already: any = await db
      .prepare('SELECT 1 FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)')
      .bind(grp.id, me.email).first();
    if (!already) {
      await db.prepare(`INSERT INTO group_members (group_id, member_email, role) VALUES (?, ?, 'member')`)
        .bind(grp.id, me.email).run();
      await refreshMemberCount(db, grp.id);
    }
    await db.prepare(`UPDATE group_invites SET used_at=datetime('now'), used_by_email=? WHERE id=?`)
      .bind(me.email, inv.id).run();
    return j(200, { ok: true, slug: grp.slug });
  }

  // ── KICK ──
  if (action === 'kick') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    const targetEmail = String(body.member_email || '').trim().toLowerCase();
    if (!groupId || !targetEmail) return j(400, { ok: false, error: 'missing_params' });
    const role = await memberRole(db, groupId, me.email);
    if (role !== 'owner') return j(403, { ok: false, error: 'owner_only' });
    if (targetEmail === me.email.toLowerCase()) return j(400, { ok: false, error: 'cant_kick_self' });
    await db.prepare('DELETE FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)')
      .bind(groupId, targetEmail).run();
    await refreshMemberCount(db, groupId);
    return j(200, { ok: true });
  }

  // ── DELETE ──
  if (action === 'delete') {
    const groupId = parseInt(String(body.group_id || '0'), 10);
    if (!groupId) return j(400, { ok: false, error: 'missing_group' });
    const role = await memberRole(db, groupId, me.email);
    if (role !== 'owner') return j(403, { ok: false, error: 'owner_only' });
    // Null out group_id on scoped events instead of deleting them.
    try { await db.prepare('UPDATE events SET group_id = NULL WHERE group_id = ?').bind(groupId).run(); } catch {}
    await db.prepare('DELETE FROM group_members WHERE group_id=?').bind(groupId).run();
    await db.prepare('DELETE FROM group_invites WHERE group_id=?').bind(groupId).run();
    await db.prepare('DELETE FROM groups WHERE id=?').bind(groupId).run();
    return j(200, { ok: true });
  }

  return j(400, { ok: false, error: 'unknown_action' });
};
