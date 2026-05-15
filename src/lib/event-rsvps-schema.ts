// Idempotent helpers for the event_rsvps table — the reminder cron and
// QR check-in feature both need a couple new columns.
export async function ensureEventRsvpsSchema(db: D1Database): Promise<void> {
  const cols = await db.prepare("PRAGMA table_info(event_rsvps)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));
  if (!names.has('reminder_sent_at')) {
    await db.prepare("ALTER TABLE event_rsvps ADD COLUMN reminder_sent_at TEXT").run();
  }
  if (!names.has('checkin_token')) {
    await db.prepare("ALTER TABLE event_rsvps ADD COLUMN checkin_token TEXT").run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_event_rsvps_checkin_token ON event_rsvps(checkin_token)").run();
  }
}

export function generateCheckinToken(): string {
  // 16 hex chars — random enough to be unguessable, short enough for a QR
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}
