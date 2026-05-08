// Idempotently adds columns needed for reminder emails.
// Safe to call on every request — PRAGMA reads are cheap and ALTER only runs once.
export async function ensurePotluckSchema(db: D1Database): Promise<void> {
  const potluckCols = await db.prepare("PRAGMA table_info(potlucks)").all();
  const potluckNames = new Set((potluckCols.results ?? []).map((r: any) => r.name));
  if (!potluckNames.has('event_date')) {
    await db.prepare("ALTER TABLE potlucks ADD COLUMN event_date TEXT").run();
  }

  const rsvpCols = await db.prepare("PRAGMA table_info(potluck_rsvp)").all();
  const rsvpNames = new Set((rsvpCols.results ?? []).map((r: any) => r.name));
  if (!rsvpNames.has('reminder_sent_at')) {
    await db.prepare("ALTER TABLE potluck_rsvp ADD COLUMN reminder_sent_at TEXT").run();
  }
}
