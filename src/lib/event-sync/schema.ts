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
      webhook_token TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_synced_at TEXT,
      last_status TEXT,
      last_error TEXT,
      last_count INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();

  // Older deploys may already have event_sources without webhook_token.
  const srcCols = await db.prepare("PRAGMA table_info(event_sources)").all();
  const srcNames = new Set((srcCols.results ?? []).map((r: any) => r.name));
  if (!srcNames.has('webhook_token')) {
    await db.prepare("ALTER TABLE event_sources ADD COLUMN webhook_token TEXT").run();
  }

  const cols = await db.prepare("PRAGMA table_info(events)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));

  const adds: Array<[string, string]> = [
    ['external_source', 'TEXT'],
    ['external_id', 'TEXT'],
    ['external_url', 'TEXT'],
    ['synced_at', 'TEXT'],
    ['discord_mirror_event_id', 'TEXT'],
    ['discord_mirror_message_id', 'TEXT'],
    ['discord_mirror_guild_id', 'TEXT'],
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
