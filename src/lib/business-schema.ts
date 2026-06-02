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

  // listing_type lets a listing be a real business or just an individual
  // offering a service / side hustle. Idempotent ALTER (D1 lacks IF NOT EXISTS).
  const cols = await db.prepare("PRAGMA table_info(business_listings)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));
  if (!names.has('listing_type')) {
    try { await db.prepare("ALTER TABLE business_listings ADD COLUMN listing_type TEXT DEFAULT 'business'").run(); } catch {}
  }
}

export const LISTING_TYPES = [
  { key: 'business',   label: 'Business',    emoji: '💼' },
  { key: 'individual', label: 'Side hustle', emoji: '✋' },
] as const;

export function listingType(key: string | null | undefined) {
  return LISTING_TYPES.find(t => t.key === key) || null;
}
export const LISTING_TYPE_KEYS: string[] = LISTING_TYPES.map(t => t.key);

export const BUSINESS_CATEGORIES = [
  { key: 'photo',     label: 'Photo & Video',      emoji: '📸', color: '#7A53B0' },
  { key: 'music',     label: 'Music & DJ',         emoji: '🎵', color: '#9C36B5' },
  { key: 'art',       label: 'Art & Design',       emoji: '🎨', color: '#3B6FB0' },
  { key: 'beauty',    label: 'Beauty & Hair',      emoji: '💇', color: '#D6336C' },
  { key: 'fitness',   label: 'Fitness & Coaching', emoji: '🏋️', color: '#2F9E6E' },
  { key: 'tutoring',  label: 'Tutoring & Lessons', emoji: '📚', color: '#5B21B6' },
  { key: 'childcare', label: 'Childcare & Sitting', emoji: '👶', color: '#2BA8C4' },
  { key: 'pets',      label: 'Pet Care',           emoji: '🐕', color: '#E8902A' },
  { key: 'food',      label: 'Food & Baking',      emoji: '🍰', color: '#E2542C' },
  { key: 'home',      label: 'Home & Handywork',   emoji: '🔧', color: '#B5732B' },
  { key: 'yard',      label: 'Yard & Lawn',        emoji: '🌳', color: '#4D7C0F' },
  { key: 'cleaning',  label: 'Cleaning',           emoji: '🧹', color: '#0E8A7D' },
  { key: 'errands',   label: 'Moving & Errands',   emoji: '🧺', color: '#B45309' },
  { key: 'tech',      label: 'Tech & Web',         emoji: '💻', color: '#4263EB' },
  { key: 'pro',       label: 'Professional',       emoji: '📋', color: '#5E7068' },
  { key: 'auto',      label: 'Auto',               emoji: '🚗', color: '#C2410C' },
  { key: 'other',     label: 'Other',              emoji: '🌿', color: '#15803D' },
] as const;

export function businessCategory(key: string | null | undefined) {
  return BUSINESS_CATEGORIES.find(c => c.key === key) || null;
}

export const BUSINESS_CATEGORY_KEYS: string[] = BUSINESS_CATEGORIES.map(c => c.key);
