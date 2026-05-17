// Canonical Denver neighborhood list for the flyer-board frame.
// Hardcoded for v1 — lat/lng comes from rough centroids. Used by the
// hero picker, the /community resolver, and the post composer.

export type Neighborhood = {
  slug: string;
  label: string;
  area: string;
  lat: number;
  lng: number;
  neighbors?: string[];  // editorial adjacency — real-life next-door hoods
};

export const NEIGHBORHOODS: Neighborhood[] = [
  // Central / downtown core
  { slug: 'lodo',          label: 'LoDo',           area: 'Downtown',              lat: 39.7530, lng: -104.9990, neighbors: ['rino','lohi','capitol-hill','five-points'] },
  { slug: 'rino',          label: 'RiNo',           area: 'Downtown',              lat: 39.7707, lng: -104.9819, neighbors: ['five-points','lodo','lohi','capitol-hill','cherry-creek'] },
  { slug: 'lohi',          label: 'LoHi',           area: 'Downtown',              lat: 39.7587, lng: -105.0085, neighbors: ['lodo','highlands','rino','speer'] },
  { slug: 'five-points',   label: 'Five Points',    area: 'Central',               lat: 39.7593, lng: -104.9794, neighbors: ['rino','capitol-hill','city-park','lodo'] },
  { slug: 'capitol-hill',  label: 'Capitol Hill',   area: 'Central',               lat: 39.7355, lng: -104.9787, neighbors: ['cherry-creek','speer','five-points','congress-park','rino'] },
  { slug: 'speer',         label: 'Speer',          area: 'Central',               lat: 39.7235, lng: -104.9851, neighbors: ['capitol-hill','baker','lohi','wash-park'] },

  // West / Northwest
  { slug: 'highlands',     label: 'Highlands',      area: 'Northwest',             lat: 39.7647, lng: -105.0178, neighbors: ['lohi','sloans-lake','berkeley'] },
  { slug: 'berkeley',      label: 'Berkeley',       area: 'Northwest',             lat: 39.7795, lng: -105.0420, neighbors: ['highlands','sloans-lake'] },
  { slug: 'sloans-lake',   label: "Sloan's Lake",   area: 'Northwest',             lat: 39.7497, lng: -105.0494, neighbors: ['highlands','berkeley'] },

  // East / Northeast
  { slug: 'city-park',     label: 'City Park',      area: 'East',                  lat: 39.7475, lng: -104.9476, neighbors: ['five-points','congress-park','park-hill'] },
  { slug: 'congress-park', label: 'Congress Park',  area: 'East',                  lat: 39.7349, lng: -104.9554, neighbors: ['cherry-creek','capitol-hill','city-park','hilltop'] },
  { slug: 'park-hill',     label: 'Park Hill',      area: 'East',                  lat: 39.7497, lng: -104.9214, neighbors: ['city-park','stapleton','lowry'] },
  { slug: 'cherry-creek',  label: 'Cherry Creek',   area: 'East',                  lat: 39.7180, lng: -104.9540, neighbors: ['capitol-hill','wash-park','hilltop','congress-park','rino'] },
  { slug: 'hilltop',       label: 'Hilltop',        area: 'East',                  lat: 39.7176, lng: -104.9335, neighbors: ['cherry-creek','congress-park','lowry','virginia-vale'] },
  { slug: 'stapleton',     label: 'Central Park',   area: 'Northeast',             lat: 39.7656, lng: -104.8929, neighbors: ['park-hill','lowry','green-valley'] },
  { slug: 'lowry',         label: 'Lowry',          area: 'Northeast',             lat: 39.7172, lng: -104.8970, neighbors: ['park-hill','hilltop','stapleton','virginia-vale'] },
  { slug: 'green-valley',  label: 'Green Valley Ranch', area: 'Far Northeast',     lat: 39.7913, lng: -104.7654, neighbors: ['stapleton','dia'] },
  { slug: 'dia',           label: 'DIA / Gateway',  area: 'Far Northeast',         lat: 39.8617, lng: -104.6731, neighbors: ['green-valley'] },

  // South
  { slug: 'wash-park',     label: 'Wash Park',      area: 'South',                 lat: 39.7008, lng: -104.9701, neighbors: ['baker','platt-park','speer','cherry-creek'] },
  { slug: 'baker',         label: 'Baker',          area: 'South',                 lat: 39.7203, lng: -104.9923, neighbors: ['wash-park','speer','platt-park'] },
  { slug: 'platt-park',    label: 'Platt Park',     area: 'South',                 lat: 39.6810, lng: -104.9836, neighbors: ['wash-park','baker','university'] },
  { slug: 'university',    label: 'University',     area: 'South',                 lat: 39.6776, lng: -104.9621, neighbors: ['platt-park','wellshire','virginia-vale'] },
  { slug: 'wellshire',     label: 'Wellshire',      area: 'South',                 lat: 39.6650, lng: -104.9595, neighbors: ['university','platt-park'] },
  { slug: 'virginia-vale', label: 'Virginia Vale',  area: 'Southeast',             lat: 39.6929, lng: -104.9163, neighbors: ['lowry','hilltop','university'] },

  // Southwest
  { slug: 'westwood',      label: 'Westwood',       area: 'Southwest',             lat: 39.6918, lng: -105.0411, neighbors: [] },
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

// "Nearby" prefers editorial adjacency (real-life next-door hoods).
// Falls back to closest-by-distance for hoods without a curated list.
export function nearbyNeighborhoods(slug: string, _maxMiles = 5, limit = 5): Neighborhood[] {
  const here = getNeighborhood(slug);
  if (!here) return [];
  if (here.neighbors && here.neighbors.length > 0) {
    return here.neighbors.map(s => BY_SLUG.get(s)).filter(Boolean).slice(0, limit) as Neighborhood[];
  }
  return NEIGHBORHOODS
    .filter(n => n.slug !== here.slug)
    .map(n => ({ n, mi: milesBetween(here, n) }))
    .filter(x => x.mi <= _maxMiles)
    .sort((a, b) => a.mi - b.mi)
    .slice(0, limit)
    .map(x => x.n);
}

// Group neighborhoods by area for the dropdown picker.
export function neighborhoodsByArea(): Array<{ area: string; items: Neighborhood[] }> {
  const buckets = new Map<string, Neighborhood[]>();
  for (const n of NEIGHBORHOODS) {
    if (!buckets.has(n.area)) buckets.set(n.area, []);
    buckets.get(n.area)!.push(n);
  }
  return Array.from(buckets.entries()).map(([area, items]) => ({ area, items }));
}
