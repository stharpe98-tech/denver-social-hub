// Schema + helpers for Groups (subcommunities) with a member-driven invite
// system. Public groups can be joined freely; invite-only groups require an
// active invite code.

export async function ensureGroupsSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      creator_email TEXT NOT NULL,
      privacy TEXT DEFAULT 'public',
      member_count INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS group_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      member_email TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      joined_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(group_id, member_email)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS group_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      inviter_email TEXT NOT NULL,
      invitee_email TEXT,
      code TEXT UNIQUE NOT NULL,
      used_at TEXT,
      used_by_email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT
    )
  `).run();
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'group';
}

export function inviteCode(): string {
  // 12-char base36 random — enough entropy for a non-guessable URL token
  const a = crypto.getRandomValues(new Uint32Array(2));
  return (a[0].toString(36) + a[1].toString(36)).padEnd(12, '0').slice(0, 12);
}

export async function isMember(db: D1Database, groupId: number, email: string): Promise<boolean> {
  const row: any = await db
    .prepare('SELECT 1 FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)')
    .bind(groupId, email).first();
  return !!row;
}

export async function memberRole(db: D1Database, groupId: number, email: string): Promise<string | null> {
  const row: any = await db
    .prepare('SELECT role FROM group_members WHERE group_id=? AND LOWER(member_email)=LOWER(?)')
    .bind(groupId, email).first();
  return row?.role || null;
}

export async function refreshMemberCount(db: D1Database, groupId: number): Promise<void> {
  const row: any = await db
    .prepare('SELECT COUNT(*) as c FROM group_members WHERE group_id=?')
    .bind(groupId).first();
  await db.prepare('UPDATE groups SET member_count=? WHERE id=?').bind(row?.c || 0, groupId).run();
}
