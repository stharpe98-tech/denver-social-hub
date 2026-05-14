// Common shape for an event coming from any external source, plus the upsert
// helper that lands it in the `events` table. Dedupe key is (source, externalId).

const MONTH_ABBR = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export interface NormalizedEvent {
  source: string;             // 'discord' | 'ics' | ...
  externalId: string;         // stable id from the source
  title: string;
  description?: string;
  startsAt?: Date | null;     // best-effort start time
  location?: string;          // human-readable, may include venue
  url?: string;               // link back to source
  eventType?: string;         // mapped to existing event_type column
  spots?: number | null;
}

export interface UpsertResult {
  inserted: number;
  updated: number;
}

export function dateToMonthDay(d: Date | null | undefined): { month: string; day: string } {
  if (!d || isNaN(d.getTime())) return { month: '', day: '' };
  return { month: MONTH_ABBR[d.getUTCMonth()] || '', day: String(d.getUTCDate()) };
}

// Don't import events whose start date is more than 14 days in the past — they
// only add noise to /events. Future and recent-past entries pass through.
export function isRecentOrFuture(d: Date | null | undefined): boolean {
  if (!d || isNaN(d.getTime())) return true;
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return d.getTime() >= cutoff;
}

export async function upsertEvent(db: D1Database, ev: NormalizedEvent): Promise<'inserted' | 'updated' | 'skipped'> {
  if (!ev.title || !ev.title.trim()) return 'skipped';
  if (!isRecentOrFuture(ev.startsAt)) return 'skipped';

  const { month, day } = dateToMonthDay(ev.startsAt);
  const now = new Date().toISOString();
  const title = ev.title.trim().slice(0, 200);
  const description = (ev.description || '').trim().slice(0, 2000);
  const location = (ev.location || '').trim().slice(0, 200);
  const url = (ev.url || '').trim().slice(0, 500);
  const eventType = (ev.eventType || 'social').slice(0, 40);
  const spots = typeof ev.spots === 'number' ? ev.spots : null;

  const existing: any = await db
    .prepare(`SELECT id FROM events WHERE external_source = ? AND external_id = ? LIMIT 1`)
    .bind(ev.source, ev.externalId)
    .first();

  if (existing?.id) {
    await db.prepare(
      `UPDATE events
         SET title = ?, description = ?, event_type = ?, location = ?, zone = ?,
             event_month = ?, event_day = ?, external_url = ?, synced_at = ?
       WHERE id = ?`
    ).bind(
      title, description, eventType, location, location || 'TBD',
      month, day, url, now, existing.id
    ).run();
    return 'updated';
  }

  await db.prepare(
    `INSERT INTO events
       (title, description, event_type, location, zone, event_month, event_day,
        spots, submitted_by, discord_link,
        external_source, external_id, external_url, synced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title, description, eventType, location, location || 'TBD',
    month, day, spots, `Sync: ${ev.source}`, url,
    ev.source, ev.externalId, url, now
  ).run();
  return 'inserted';
}

export async function upsertMany(db: D1Database, events: NormalizedEvent[]): Promise<UpsertResult> {
  let inserted = 0, updated = 0;
  for (const ev of events) {
    const r = await upsertEvent(db, ev);
    if (r === 'inserted') inserted++;
    else if (r === 'updated') updated++;
  }
  return { inserted, updated };
}
