const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

export function potluckSlug(eventDate: string | null | undefined, id: number): string {
  if (!eventDate) return `potluck-${id}`;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate);
  if (!m) return `potluck-${id}`;
  const month = MONTHS[parseInt(m[2], 10) - 1];
  const day = parseInt(m[3], 10);
  if (!month || !day) return `potluck-${id}`;
  return `${month}${day}potluck`;
}

export const POTLUCK_SLUG_RE = /^[a-z]{3}\d{1,2}potluck(-\d+)?$|^potluck-\d+$/;
