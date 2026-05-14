// Co-hosts let an event organizer share organizing duties with other
// members. A co-host is just a row pointing an event_id at a member's
// email; permission checks elsewhere treat them like the host.

export async function ensureCohostsSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS event_cohosts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      member_email TEXT NOT NULL,
      added_by INTEGER,
      added_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, member_email)
    )
  `).run();
}

export async function isHostOrCohost(
  db: D1Database, eventId: number, user: { id?: number; email?: string }
): Promise<boolean> {
  if (!user?.email && !user?.id) return false;
  const ev: any = await db.prepare('SELECT host_id, submitted_by FROM events WHERE id=?').bind(eventId).first();
  if (!ev) return false;
  if (user.id && ev.host_id === user.id) return true;
  if (user.email) {
    const co: any = await db
      .prepare('SELECT 1 FROM event_cohosts WHERE event_id=? AND LOWER(member_email)=LOWER(?)')
      .bind(eventId, user.email).first();
    if (co) return true;
  }
  return false;
}
