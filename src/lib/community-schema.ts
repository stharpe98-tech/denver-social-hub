// Schema helpers for the community-feel batch:
// - member_intros: "say hi" posts from new members
// - favors: skill exchange (offers + needs) — neighbor-style help
// - community_calendar: shared Denver dates (holidays, local events, traditions)
// - members.extra_role: optional named role like "Hike captain"

export async function ensureCommunitySchema(db: D1Database): Promise<void> {
  // 1. Intros
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS member_intros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_email TEXT NOT NULL,
      member_name TEXT,
      neighborhood TEXT,
      body TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(member_email)
    )
  `).run();

  // 2. Favors (skill exchange)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS favors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_email TEXT NOT NULL,
      member_name TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      neighborhood TEXT,
      status TEXT DEFAULT 'open',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_favors_status ON favors(status, created_at)`).run();

  // Extended fields for the flyer-board direction. Adds are idempotent
  // — wrap each in try/catch because D1 ALTER lacks IF NOT EXISTS.
  const favorCols = await db.prepare("PRAGMA table_info(favors)").all();
  const favorNames = new Set((favorCols.results ?? []).map((r: any) => r.name));
  for (const [col, type] of [
    ['contact_email', "TEXT DEFAULT ''"],
    ['contact_phone', "TEXT DEFAULT ''"],
    ['kind_extended', "TEXT DEFAULT ''"],
  ] as const) {
    if (!favorNames.has(col)) {
      try { await db.prepare(`ALTER TABLE favors ADD COLUMN ${col} ${type}`).run(); } catch {}
    }
  }
  // profiles: neighborhood + contact fields (regulars can store these
  // for flyer auto-prefill; organizers already use them on their public page).
  try {
    const pCols = await db.prepare("PRAGMA table_info(profiles)").all();
    const pNames = new Set((pCols.results ?? []).map((r: any) => r.name));
    for (const [col, type] of [
      ['neighborhood', "TEXT DEFAULT ''"],
      ['contact_email', "TEXT DEFAULT ''"],
      ['contact_phone', "TEXT DEFAULT ''"],
      ['template', "TEXT DEFAULT 'host'"],
      ['template_data', "TEXT DEFAULT '{}'"],
    ] as const) {
      if (!pNames.has(col)) {
        try { await db.prepare(`ALTER TABLE profiles ADD COLUMN ${col} ${type}`).run(); } catch {}
      }
    }
  } catch {}

  // 3. Community calendar
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS community_calendar (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      kind TEXT NOT NULL,
      date_label TEXT NOT NULL,
      sort_month INTEGER,
      sort_day INTEGER,
      description TEXT,
      url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_calendar_sort ON community_calendar(sort_month, sort_day)`).run();

  // 4. extra_role on members
  const cols = await db.prepare("PRAGMA table_info(members)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));
  if (!names.has('extra_role')) {
    await db.prepare("ALTER TABLE members ADD COLUMN extra_role TEXT").run();
  }
}

export const FAVOR_KINDS = [
  { key: 'offer', label: 'I can help with', emoji: '🤝' },
  { key: 'need',  label: 'I need help with', emoji: '🙏' },
];

// Extended kind taxonomy used by the flyer-board (stored in
// favors.kind_extended). The legacy `kind` column stays 'offer'/'need'
// for back-compat; events/announcements/just-because default to 'offer'.
export const BOARD_KINDS = [
  { key: 'need',         label: 'Need',         emoji: '🙏', dot: 'need',     legacy: 'need'  },
  { key: 'offer',        label: 'Offer',        emoji: '🤝', dot: 'offer',    legacy: 'offer' },
  { key: 'event',        label: 'Event',        emoji: '🎉', dot: 'event',    legacy: 'offer' },
  { key: 'announce',     label: 'Announcement', emoji: '📣', dot: 'announce', legacy: 'offer' },
  { key: 'just_because', label: 'Just because', emoji: '💛', dot: 'announce', legacy: 'offer' },
] as const;

export const CALENDAR_KINDS = [
  { key: 'holiday',    label: 'Holiday',         emoji: '🎉' },
  { key: 'local',      label: 'Denver tradition',emoji: '🏔️' },
  { key: 'community',  label: 'Community',       emoji: '👥' },
  { key: 'first',      label: 'First-of-the-year',emoji: '✨' },
];

// Seed the calendar with well-known Denver dates if the table is empty
export async function seedCommunityCalendar(db: D1Database): Promise<void> {
  const c: any = await db.prepare("SELECT COUNT(*) as c FROM community_calendar").first();
  if ((c?.c || 0) > 0) return;
  const seeds = [
    { title: "New Year's Day",                        kind: 'holiday',    date_label: 'Jan 1',       m: 1,  d: 1 },
    { title: 'First Friday Art Walk · RiNo',          kind: 'local',      date_label: 'First Friday of each month', m: null, d: null },
    { title: 'St. Patrick\'s Day Parade · Downtown',  kind: 'local',      date_label: 'Mid-March',   m: 3,  d: 15 },
    { title: 'Cinco de Mayo Festival · Civic Center', kind: 'local',      date_label: 'Early May',   m: 5,  d: 5 },
    { title: 'Cherry Creek Sneak',                    kind: 'local',      date_label: 'Late April',  m: 4,  d: 25 },
    { title: 'Memorial Day',                          kind: 'holiday',    date_label: 'Last Mon May',m: 5,  d: 31 },
    { title: 'Pride Fest · Civic Center',             kind: 'local',      date_label: 'Late June',   m: 6,  d: 24 },
    { title: 'July Fourth fireworks',                 kind: 'holiday',    date_label: 'July 4',      m: 7,  d: 4 },
    { title: 'Underground Music Showcase',            kind: 'local',      date_label: 'Late July',   m: 7,  d: 25 },
    { title: 'A Taste of Colorado · Civic Center',    kind: 'local',      date_label: 'Labor Day weekend', m: 9, d: 1 },
    { title: 'Great American Beer Festival',          kind: 'local',      date_label: 'Late Sept / early Oct', m: 9, d: 30 },
    { title: 'Denver Film Festival',                  kind: 'local',      date_label: 'Early November', m: 11, d: 1 },
    { title: 'Parade of Lights · Downtown',           kind: 'local',      date_label: 'First Friday in December', m: 12, d: 1 },
    { title: 'Zoo Lights',                            kind: 'local',      date_label: 'Late Nov – early Jan', m: 12, d: 10 },
    { title: 'Denver Social birthday 🎂',             kind: 'community',  date_label: 'Mar 1',       m: 3,  d: 1 },
    { title: 'First warm day in spring',              kind: 'first',      date_label: 'Whenever it lands', m: 3, d: 20 },
    { title: 'First snow of the year',                kind: 'first',      date_label: 'Whenever it lands', m: 10, d: 15 },
  ];
  for (const s of seeds) {
    try {
      await db.prepare(
        'INSERT INTO community_calendar (title, kind, date_label, sort_month, sort_day) VALUES (?, ?, ?, ?, ?)'
      ).bind(s.title, s.kind, s.date_label, s.m, s.d).run();
    } catch {}
  }
}
