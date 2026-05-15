// Privacy-respecting phone exchange: someone requests, recipient approves
// and shares (or declines). The phone is stored ONLY on the approval row,
// not on anyone's profile — keeps personal phone numbers out of the
// general member record.

export async function ensurePhoneRequestsSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS phone_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_email TEXT NOT NULL,
      to_email TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      shared_phone TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      responded_at TEXT
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_phone_reqs_to ON phone_requests(to_email, status)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_phone_reqs_from ON phone_requests(from_email, status)`).run();
}
