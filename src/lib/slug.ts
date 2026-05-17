// Potluck slug helpers. Slug format: <Month><Day>potluck — e.g. "April30potluck".
// Used by /[slug].astro route and the INSERT path in api/potlucks.ts.

const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

/**
 * Build the canonical slug for a potluck from its event_date.
 * - Format: "April30potluck", "May5potluck" (no zero pad, capitalized full month)
 * - Falls back to "potluck-<id>" when event_date is missing or unparseable.
 */
export function potluckSlug(eventDate: string | null | undefined, id: number): string {
  if (!eventDate) return `potluck-${id}`;
  // event_date is stored as YYYY-MM-DD in D1
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate);
  if (!m) return `potluck-${id}`;
  const month = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return `potluck-${id}`;
  return `${MONTHS_FULL[month - 1]}${day}potluck`;
}

// Pattern matching valid potluck slugs (with optional -2, -3 dedup suffix).
// Accepts both "April30potluck" and "potluck-<id>" fallback form.
export const POTLUCK_SLUG_RE =
  /^(?:[A-Z][a-z]+\d{1,2}potluck(?:-\d+)?|potluck-\d+)$/;
