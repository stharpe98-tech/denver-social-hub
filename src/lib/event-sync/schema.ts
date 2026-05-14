// Idempotent schema for the event sync bot.
// Adds `event_sources` (one row per external connection) and tracking columns
// on `events` so we can dedupe imported events. Safe to call on every request.

export async function ensureEventSyncSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS event_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      label TEXT,
      config TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      last_status TEXT,
      last_error TEXT,
      last_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  const cols = await db.prepare("PRAGMA table_info(events)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));

  const adds: Array<[string, string]> = [
    ['external_source', 'TEXT'],
    ['external_id', 'TEXT'],
    ['external_url', 'TEXT'],
    ['synced_at', 'TEXT'],
  ];
  for (const [col, type] of adds) {
    if (!names.has(col)) {
      await db.prepare(`ALTER TABLE events ADD COLUMN ${col} ${type}`).run();
    }
  }

  // Lookup index for upserts. SQLite ignores duplicate CREATE INDEX IF NOT EXISTS.
  await db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_events_external
    ON events(external_source, external_id)
  `).run();
}
