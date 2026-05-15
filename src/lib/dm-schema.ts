// Direct messages — 1:1 chat between two members.
// Polling-based (frontend hits /api/dm?action=poll every ~4s) so we don't
// need Durable Objects or a paid plan. Good enough for MVP.

export async function ensureDmSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_a_email TEXT NOT NULL,
      member_b_email TEXT NOT NULL,
      last_msg_at TEXT,
      last_msg_preview TEXT,
      last_msg_from TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(member_a_email, member_b_email)
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS dm_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      from_email TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_dm_messages_conv ON dm_messages(conversation_id, id)`).run();
}

// Canonical conversation key: alphabetical (lowercased) pair so we never
// create two conversations for the same A↔B pair.
export function pairKey(a: string, b: string): { lo: string; hi: string } {
  const aL = (a || '').toLowerCase();
  const bL = (b || '').toLowerCase();
  return aL < bL ? { lo: aL, hi: bL } : { lo: bL, hi: aL };
}

export async function getOrCreateConversation(db: D1Database, a: string, b: string): Promise<number> {
  const { lo, hi } = pairKey(a, b);
  let row: any = await db.prepare('SELECT id FROM dm_conversations WHERE member_a_email=? AND member_b_email=?').bind(lo, hi).first();
  if (row?.id) return row.id;
  const res: any = await db.prepare(
    'INSERT INTO dm_conversations (member_a_email, member_b_email) VALUES (?, ?)'
  ).bind(lo, hi).run();
  return res?.meta?.last_row_id;
}
