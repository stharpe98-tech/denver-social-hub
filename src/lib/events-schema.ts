// Idempotent schema helpers for the `events` table.
// Safe to call on every request — PRAGMA reads are cheap and ALTER runs once.
export async function ensureEventsSchema(db: D1Database): Promise<void> {
  const cols = await db.prepare("PRAGMA table_info(events)").all();
  const names = new Set((cols.results ?? []).map((r: any) => r.name));
  if (!names.has('vibe_tags')) {
    // Comma-separated for simplicity (e.g. "sober,introvert,lgbtq").
    await db.prepare("ALTER TABLE events ADD COLUMN vibe_tags TEXT").run();
  }
  if (!names.has('group_id')) {
    // Optional link to a Group — null means "site-wide", not scoped.
    await db.prepare("ALTER TABLE events ADD COLUMN group_id INTEGER").run();
  }
}

// Canonical vibe-tag dictionary. Keep keys URL/storage-friendly; labels
// drive the UI.
export const VIBE_TAGS: { key: string; label: string; emoji: string }[] = [
  { key: 'sober',     label: 'Sober-friendly',     emoji: '🥤' },
  { key: 'introvert', label: 'Introvert-friendly', emoji: '🤫' },
  { key: 'kids',      label: 'Kid-friendly',       emoji: '🧒' },
  { key: 'lgbtq',     label: 'LGBTQ+ welcome',     emoji: '🏳️‍🌈' },
  { key: 'adults',    label: '21+',                emoji: '🍷' },
  { key: 'dogs',      label: 'Dog-friendly',       emoji: '🐕' },
];

export function parseVibeTags(stored: string | null | undefined): string[] {
  if (!stored) return [];
  return stored.split(',').map(s => s.trim()).filter(Boolean);
}

export function vibeLabel(key: string): { label: string; emoji: string } | null {
  const hit = VIBE_TAGS.find(t => t.key === key);
  return hit ? { label: hit.label, emoji: hit.emoji } : null;
}
