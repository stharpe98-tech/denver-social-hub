// Partners: local businesses that offer perks (discounts, free items,
// group menus, etc.) to Denver Social attendees. Anyone can submit; an
// admin approves before it appears on /perks.

export async function ensurePartnersSchema(db: D1Database): Promise<void> {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      business_name TEXT NOT NULL,
      category TEXT,
      neighborhood TEXT,
      offer_title TEXT NOT NULL,
      offer_details TEXT,
      redemption TEXT,
      website TEXT,
      contact_email TEXT NOT NULL,
      submitted_by_email TEXT,
      status TEXT DEFAULT 'pending',
      reviewed_at TEXT,
      reviewed_by TEXT,
      view_count INTEGER DEFAULT 0,
      claim_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status, created_at)`).run();
}

export const PARTNER_CATEGORIES = [
  { key: 'food',     label: 'Food & dining', emoji: '🍽️' },
  { key: 'drink',    label: 'Bars & breweries', emoji: '🍺' },
  { key: 'coffee',   label: 'Coffee', emoji: '☕' },
  { key: 'fitness',  label: 'Fitness & wellness', emoji: '💪' },
  { key: 'arts',     label: 'Arts & culture', emoji: '🎨' },
  { key: 'outdoor',  label: 'Outdoor & adventure', emoji: '🏔️' },
  { key: 'shop',     label: 'Shops & retail', emoji: '🛍️' },
  { key: 'service',  label: 'Services', emoji: '🛠' },
  { key: 'other',    label: 'Other', emoji: '✨' },
];

export function partnerSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'partner';
}

export function categoryLabel(key: string): { label: string; emoji: string } | null {
  const hit = PARTNER_CATEGORIES.find(c => c.key === key);
  return hit ? { label: hit.label, emoji: hit.emoji } : null;
}
