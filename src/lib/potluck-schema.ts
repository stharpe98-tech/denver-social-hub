// Idempotently adds columns needed for reminder emails.
// Safe to call on every request — PRAGMA reads are cheap and ALTER only runs once.
export async function ensurePotluckSchema(db: D1Database): Promise<void> {
  const potluckCols = await db.prepare("PRAGMA table_info(potlucks)").all();
  const potluckNames = new Set((potluckCols.results ?? []).map((r: any) => r.name));
  if (!potluckNames.has('event_date')) {
    await db.prepare("ALTER TABLE potlucks ADD COLUMN event_date TEXT").run();
  }
  if (!potluckNames.has('cover_photo')) {
    await db.prepare("ALTER TABLE potlucks ADD COLUMN cover_photo TEXT").run();
  }

  const slotCols = await db.prepare("PRAGMA table_info(potluck_slots)").all();
  const slotNames = new Set((slotCols.results ?? []).map((r: any) => r.name));
  if (!slotNames.has('slot_time')) {
    await db.prepare("ALTER TABLE potluck_slots ADD COLUMN slot_time TEXT").run();
  }

  const rsvpCols = await db.prepare("PRAGMA table_info(potluck_rsvp)").all();
  const rsvpNames = new Set((rsvpCols.results ?? []).map((r: any) => r.name));
  if (!rsvpNames.has('reminder_sent_at')) {
    await db.prepare("ALTER TABLE potluck_rsvp ADD COLUMN reminder_sent_at TEXT").run();
  }
}
