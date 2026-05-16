// Canonical Denver neighborhood list for the flyer-board frame.
// Hardcoded for v1 — lat/lng comes from rough centroids. Used by the
// hero picker, the /community resolver, and the post composer.

export type Neighborhood = {
  slug: string;
  label: string;
  area: string;
  lat: number;
  lng: number;
};

export const NEIGHBORHOODS: Neighborhood[] = [
  { slug: 'wash-park',     label: 'Wash Park',      area: 'South-central Denver',  lat: 39.7008, lng: -104.9701 },
  { slug: 'capitol-hill',  label: 'Capitol Hill',   area: 'Central Denver',        lat: 39.7355, lng: -104.9787 },
  { slug: 'cherry-creek',  label: 'Cherry Creek',   area: 'East-central Denver',   lat: 39.7180, lng: -104.9540 },
  { slug: 'baker',         label: 'Baker',          area: 'South-central Denver',  lat: 39.7203, lng: -104.9923 },
  { slug: 'platt-park',    label: 'Platt Park',     area: 'South Denver',          lat: 39.6810, lng: -104.9836 },
  { slug: 'speer',         label: 'Speer',          area: 'Central Denver',        lat: 39.7235, lng: -104.9851 },
  { slug: 'highlands',     label: 'Highlands',      area: 'Northwest Denver',      lat: 39.7647, lng: -105.0178 },
  { slug: 'berkeley',      label: 'Berkeley',       area: 'Northwest Denver',      lat: 39.7795, lng: -105.0420 },
  { slug: 'sloans-lake',   label: "Sloan's Lake",   area: 'West Denver',           lat: 39.7497, lng: -105.0494 },
  { slug: 'rino',          label: 'RiNo',           area: 'North-central Denver',  lat: 39.7707, lng: -104.9819 },
  { slug: 'lodo',          label: 'LoDo',           area: 'Downtown Denver',       lat: 39.7530, lng: -104.9990 },
  { slug: 'lohi',          label: 'LoHi',           area: 'Northwest Denver',      lat: 39.7587, lng: -105.0085 },
  { slug: 'five-points',   label: 'Five Points',    area: 'Central Denver',        lat: 39.7593, lng: -104.9794 },
  { slug: 'congress-park', label: 'Congress Park',  area: 'East-central Denver',   lat: 39.7349, lng: -104.9554 },
  { slug: 'city-park',     label: 'City Park',      area: 'East Denver',           lat: 39.7475, lng: -104.9476 },
  { slug: 'park-hill',     label: 'Park Hill',      area: 'East Denver',           lat: 39.7497, lng: -104.9214 },
  { slug: 'stapleton',     label: 'Central Park',   area: 'Northeast Denver',      lat: 39.7656, lng: -104.8929 },
  { slug: 'lowry',         label: 'Lowry',          area: 'East Denver',           lat: 39.7172, lng: -104.8970 },
  { slug: 'dia',           label: 'DIA / Gateway',  area: 'Far Northeast Denver',  lat: 39.8617, lng: -104.6731 },
  { slug: 'university',    label: 'University',     area: 'South Denver',          lat: 39.6776, lng: -104.9621 },
  { slug: 'wellshire',     label: 'Wellshire',      area: 'South Denver',          lat: 39.6650, lng: -104.9595 },
  { slug: 'virginia-vale', label: 'Virginia Vale',  area: 'Southeast Denver',      lat: 39.6929, lng: -104.9163 },
  { slug: 'hilltop',       label: 'Hilltop',        area: 'East-central Denver',   lat: 39.7176, lng: -104.9335 },
  { slug: 'westwood',      label: 'Westwood',       area: 'Southwest Denver',      lat: 39.6918, lng: -105.0411 },
  { slug: 'green-valley',  label: 'Green Valley Ranch', area: 'Far Northeast Denver', lat: 39.7913, lng: -104.7654 },
];

const BY_SLUG = new Map(NEIGHBORHOODS.map(n => [n.slug, n]));

export function getNeighborhood(slug: string): Neighborhood | null {
  return BY_SLUG.get((slug || '').toLowerCase()) || null;
}

export function resolveNeighborhoodSlug(input: string | null | undefined): string {
  const s = (input || '').toLowerCase().trim();
  if (s === 'all') return 'all';
  if (s && BY_SLUG.has(s)) return s;
  return 'wash-park';
}

// Rough miles between two lat/lng pairs (great-circle haversine).
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function nearbyNeighborhoods(slug: string, maxMiles = 5, limit = 5): Neighborhood[] {
  const here = getNeighborhood(slug);
  if (!here) return [];
  return NEIGHBORHOODS
    .filter(n => n.slug !== here.slug)
    .map(n => ({ n, mi: milesBetween(here, n) }))
    .filter(x => x.mi <= maxMiles)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, limit)
    .map(x => x.n);
}
