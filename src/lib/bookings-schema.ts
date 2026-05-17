// Self-healing schema bootstrap for the reservation system.
// Tables: bookable_offerings, offering_availability, offering_blackouts, bookings.
// Times in availability are local Denver (MT). slot_start/slot_end stored as
// ISO UTC ("Z") in the bookings table.

export async function ensureBookingsSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS bookable_offerings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_slug TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      duration_min INTEGER NOT NULL DEFAULT 30,
      price_text TEXT DEFAULT '',
      capacity_per_slot INTEGER DEFAULT 1,
      archived INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_offerings_slug ON bookable_offerings(profile_slug)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS offering_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offering_id INTEGER NOT NULL,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      valid_from TEXT DEFAULT '',
      valid_until TEXT DEFAULT '',
      FOREIGN KEY (offering_id) REFERENCES bookable_offerings(id)
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_avail_offering ON offering_availability(offering_id)`).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS offering_blackouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offering_id INTEGER NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      reason TEXT DEFAULT ''
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_slug TEXT NOT NULL,
      offering_id INTEGER NOT NULL,
      slot_start TEXT NOT NULL,
      slot_end TEXT NOT NULL,
      requester_name TEXT NOT NULL,
      requester_email TEXT NOT NULL,
      requester_phone TEXT DEFAULT '',
      message TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      confirm_token TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      responded_at TEXT DEFAULT ''
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_slug ON bookings(profile_slug, status, slot_start)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_bookings_token ON bookings(confirm_token)`).run();

  // Master on/off switch for the reservation engine on each profile.
  // Off by default — nobody is opted in until they activate it from /dashboard/booking-setup.
  try {
    const pCols = await db.prepare("PRAGMA table_info(profiles)").all();
    const pNames = new Set((pCols.results ?? []).map((r: any) => r.name));
    if (!pNames.has('has_booking_tool')) {
      try { await db.prepare(`ALTER TABLE profiles ADD COLUMN has_booking_tool INTEGER DEFAULT 0`).run(); } catch {}
    }
  } catch {}
  try { await db.prepare(`CREATE INDEX IF NOT EXISTS idx_profiles_booking_enabled ON profiles(has_booking_tool)`).run(); } catch {}
}

export function randomToken(len = 24): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let s = '';
  for (const b of arr) s += (b % 36).toString(36);
  return s;
}

/**
 * Mountain Time helpers — v1 trusts the host's tz database.
 * In production this resolves via Intl APIs which Workers ship with.
 * DST edge cases (the 1-2am slot on transition day) are intentionally NOT handled.
 */
const DENVER_TZ = 'America/Denver';

/** Get the UTC offset (in minutes) for a given UTC instant, in America/Denver.
 *  Positive = MT is behind UTC (typical for the Americas). */
function denverOffsetMinutes(utcInstant: Date): number {
  // Trick: format the UTC instant in Denver wall-clock, parse it back as UTC,
  // and diff. The difference is the offset.
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(utcInstant)) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  const asUtc = Date.UTC(
    parseInt(parts.year, 10),
    parseInt(parts.month, 10) - 1,
    parseInt(parts.day, 10),
    parseInt(parts.hour, 10),
    parseInt(parts.minute, 10),
    parseInt(parts.second, 10),
  );
  // asUtc represents the Denver wall-clock interpreted as UTC.
  // Real UTC ms differs by the tz offset (in ms).
  return (asUtc - utcInstant.getTime()) / 60000;
}

/** Convert a Denver-local "YYYY-MM-DD" + "HH:MM" → ISO UTC string. */
export function denverLocalToUtcIso(dateYmd: string, timeHm: string): string {
  const [y, m, d] = dateYmd.split('-').map(n => parseInt(n, 10));
  const [hh, mm] = timeHm.split(':').map(n => parseInt(n, 10));
  // Treat the local wall-clock as if it were UTC, then subtract the offset.
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  // We need the offset at that local time. Approximate using the naive UTC
  // instant — close enough for v1 (DST edge cases not handled, per CLAUDE.md).
  const offsetMin = denverOffsetMinutes(new Date(naive));
  const real = naive - offsetMin * 60000;
  return new Date(real).toISOString();
}

/** Return Denver-local YYYY-MM-DD for a Date (or ISO string). */
export function denverYmd(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: DENVER_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return dtf.format(date); // en-CA gives YYYY-MM-DD
}

/** Return Denver day-of-week (0=Sun..6=Sat) for a Date or ISO string. */
export function denverDow(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d;
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, weekday: 'short',
  }).format(date);
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(name);
}

/** Pretty-format an ISO instant in Denver, e.g. "Sat, May 18 at 2:00 PM MT". */
export function formatDenverHuman(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, weekday: 'short', month: 'short', day: 'numeric',
  }).format(d);
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: DENVER_TZ, hour: 'numeric', minute: '2-digit',
  }).format(d);
  return `${date} at ${time} MT`;
}

/** "HH:MM" + minutes → "HH:MM" (24h clock, no overflow protection past 23:59) */
function addMinutesHm(hm: string, minutes: number): string {
  const [h, m] = hm.split(':').map(n => parseInt(n, 10));
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Compare HH:MM strings */
function hmLte(a: string, b: string): boolean {
  return a <= b; // ISO 24h string compare works lexicographically
}

/**
 * Generate slots (Denver local) for an availability window split into
 * `duration_min` increments. Returns array of { start: "HH:MM", end: "HH:MM" }.
 */
export function chopWindow(startHm: string, endHm: string, durationMin: number): Array<{ start: string; end: string }> {
  const out: Array<{ start: string; end: string }> = [];
  if (!durationMin || durationMin <= 0) return out;
  let cursor = startHm;
  // Safety cap to prevent runaway loops on malformed input.
  for (let i = 0; i < 200; i++) {
    const next = addMinutesHm(cursor, durationMin);
    if (!hmLte(next, endHm)) break;
    out.push({ start: cursor, end: next });
    cursor = next;
  }
  return out;
}

export const Booking = {
  denverLocalToUtcIso,
  denverYmd,
  denverDow,
  formatDenverHuman,
  chopWindow,
};
