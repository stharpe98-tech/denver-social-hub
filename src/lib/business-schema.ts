// Schema + taxonomy for the local business directory on the community board.
// A persistent listing (unlike one-off `favors`): name, category, contact,
// optional logo. Posting is open (name + email) — edits/deletes are gated by
// a per-listing edit_token handed back on create (same pattern as potlucks).
export async function ensureBusinessSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS business_listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_email TEXT NOT NULL,
      owner_name TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      tagline TEXT,
      description TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      instagram TEXT,
      neighborhood TEXT,
      logo_url TEXT,
      edit_token TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(
    `CREATE INDEX IF NOT EXISTS idx_business_cat ON business_listings(category, status, id)`
  ).run();
}

export const BUSINESS_CATEGORIES = [
  { key: 'photo',    label: 'Photo & Video',      emoji: '📸', color: '#7A53B0' },
  { key: 'pets',     label: 'Pet Care',           emoji: '🐕', color: '#E8902A' },
  { key: 'beauty',   label: 'Beauty & Hair',      emoji: '💇', color: '#D6336C' },
  { key: 'fitness',  label: 'Fitness & Coaching', emoji: '🏋️', color: '#2F9E6E' },
  { key: 'art',      label: 'Art & Design',       emoji: '🎨', color: '#3B6FB0' },
  { key: 'home',     label: 'Home & Handywork',   emoji: '🔧', color: '#B5732B' },
  { key: 'cleaning', label: 'Cleaning',           emoji: '🧹', color: '#0E8A7D' },
  { key: 'food',     label: 'Food & Baking',      emoji: '🍰', color: '#E2542C' },
  { key: 'tech',     label: 'Tech & Web',         emoji: '💻', color: '#4263EB' },
  { key: 'pro',      label: 'Professional',       emoji: '📋', color: '#5E7068' },
  { key: 'music',    label: 'Music & DJ',         emoji: '🎵', color: '#9C36B5' },
  { key: 'auto',     label: 'Auto',               emoji: '🚗', color: '#C2410C' },
  { key: 'other',    label: 'Other',              emoji: '🌿', color: '#15803D' },
] as const;

export function businessCategory(key: string | null | undefined) {
  return BUSINESS_CATEGORIES.find(c => c.key === key) || null;
}

export const BUSINESS_CATEGORY_KEYS: string[] = BUSINESS_CATEGORIES.map(c => c.key);
