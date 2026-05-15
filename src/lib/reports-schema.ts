// Reports: members flag content (events, groups, other members, comments)
// for moderator review. Anyone signed in can report; only admins see the queue.

export async function ensureReportsSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reporter_email TEXT NOT NULL,
      target_kind TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT DEFAULT 'open',
      resolved_at TEXT,
      resolved_by TEXT,
      resolution_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, created_at)`).run();
}

export const REPORT_REASONS: { key: string; label: string }[] = [
  { key: 'harassment',  label: 'Harassment or unsafe behavior' },
  { key: 'spam',        label: 'Spam or selling' },
  { key: 'inaccurate',  label: 'Inaccurate or misleading' },
  { key: 'inappropriate', label: 'Inappropriate content' },
  { key: 'other',       label: 'Other' },
];
