// Idempotent migration helper for the organizer-page theme preset column.
// Mirrors the shape of other lib/*-schema.ts helpers: a single async export
// that adds the column inside a try/catch so re-runs are no-ops on D1 (which
// has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

export async function ensureProfileThemeColumn(db: D1Database): Promise<void> {
  try {
    const cols = await db.prepare("PRAGMA table_info(profiles)").all();
    const names = new Set((cols.results ?? []).map((r: any) => r.name));
    if (!names.has('theme_preset')) {
      try {
        await db.prepare("ALTER TABLE profiles ADD COLUMN theme_preset TEXT").run();
      } catch {
        // Swallow "duplicate column" / race-condition errors — idempotent.
      }
    }
  } catch {
    // PRAGMA itself may fail if profiles table is missing entirely; that's
    // not this helper's problem.
  }
}
